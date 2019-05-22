import * as databaseSource from './database';
import * as _ from 'lodash';

let database = databaseSource.get();
let gradeName = process.argv[2];
let groupAmount = parseInt(process.argv[3]);
let runAmount =  parseInt(process.argv[4]);
let debugEachCompletion = process.argv[5] === '--verbose';

let db = database.firestore();

type Username = string
type Group = Username[]

interface Preferences {
    [username: string]: string[];
}

interface UserDetails {
    [username: string]: {
        isMale: boolean;
        grade: string;
    };
}

interface RunResult {
    groups: Group[];
    preferences: Preferences;
    users: UserDetails;
    details: {
        maxGroupSize: number;
        maxGroupGenderSize: number;
        groupAmount: number;
    };
}

let preferencesPromise = db.collection('preferences').doc(gradeName).get().then((snapshot) => {
    return snapshot.data();
}) as Promise<Preferences>;

let antiPreferencesPromise = db.collection('grades').doc(gradeName).get().then((snapshot) => {
    return snapshot.data()!.antiPreferences;
}) as Promise<string[]>;

let studentNamesPromise = db.collection('grades').doc(gradeName).get().then((snapshot) => {
    return snapshot.data()!.students;
}) as Promise<{ [username: string]: string }>;

let usersPromise = db.collection('user-records').get().then((snapshot) => {
    let users: UserDetails = {};
    let docs = snapshot.docs;

    docs.forEach((doc) => {
        if (!doc.data().grade || doc.data().grade !== gradeName) {
            return;
        }

        users[doc.id] = doc.data() as any;
    })

    return users;
}).catch((error: Error) => console.log(error)) as Promise<UserDetails>;

/**
 * Creates a group with a new member.
 *
 * @param {string[]} group The old list of usernames.
 * @param {string} member The new username to add.
 * @return {string[]} The new list of usernames.
 */
let groupWithNew = function copyGroupWithNewMember(group: Group, member: Username): Group {
    let newGroup = group.slice();
    newGroup.push(member);
    return newGroup;
}

/**
 * Checks whether a group has overflowed its maximum number of a certain gender,
 * and therefore must have a member removed.
 *
 * @param {string[]} group The list of usernames to check.
 * @param {boolean} isMale Whether the gender to check is male.
 * @param {number} maxAmount The maximum number of the gender to allow.
 * @param {Object} users The user detail object, containing information for usernames.
 * @return {boolean} Whether or not it has reached the maximum.
 */
let hasMaximum = function checkGenderHasMaximum(group: Group, isMale: boolean, maxAmount: number, maxAmountSame: number, users: UserDetails): boolean {
    let currentAmountSame = 0;
    let currentAmount = 0;

    for (let i = 0; i < group.length; i++) {
        currentAmount++;

        if (users[group[i]].isMale === isMale) {
            currentAmountSame++;
        }
    }

    // Add one to the amounts, since if a new user is added it should still
    // be checked.
    return currentAmountSame > maxAmountSame || currentAmount > maxAmount;
}


/**
 * Returns a score representing how much a user likes a group. In other words,
 * this is the number of friends that the user has in the group.
 *
 * @param {Object} preferences The preferences object, containing user choices.
 * @param {string[]} group The list of current group member usernames.
 * @param {string} member The member to find an favorability score for.
 * @return {number} The favorability score.
 */
let getUGScore = function getUserGroupScore(preferences: Preferences, group: Group, member: Username): number {
    let score = 0;

    for (let i = 0; i < group.length; i++) {
        let groupMember = group[i];
        if (preferences[member].includes(groupMember)) {
            score++;
        }
    }

    return score;
}

/**
 * Returns a user's ranking of group preferences. In other words, returns the
 * order of groups that contain the most of the user's friends (most favorite)
 * to the least (least favorite).
 *
 * @param {Object} preferences The preferences object, containing user choices.
 * @param {string[][]} groups The available groups to join. Each group is a list of member usernames.
 * @param {string} newMember The member choosing between group preferences.
 * @return {number[]} The ranking of group indices, from favorite to least.
 */
let getUGRanking = function findRankingOfGroupsByPreferences(preferences: Preferences, groups: Group[], newMember: Username): number[] {
    let scores = [];

    for (let i = 0; i < groups.length; i++) {
        let score = getUGScore(preferences, groups[i], newMember);
        scores.push({ groupID: i, score });
    }

    return scores.sort((a, b): number => {
        if (a.score === b.score) {
            // If they have the same exact score, go for the one with less members.
            // If they have the same number of members, pick randomly.
            let lengthDifference = groups[a.groupID].length - groups[b.groupID].length;

            if (lengthDifference === 0) {
                return _.sample([-1, 1])!;
            }

            return groups[a.groupID].length - groups[b.groupID].length;
        }

        // Otherwise, bigger score wins.
        return b.score - a.score;
    }).map((value) => {
        // Now that they're sorted, return just the group ID.
        return value.groupID;
    });
}

/**
 * Returns whether or not a user can try to join a group. Note, this does not
 * mean that the user can join; rather, it means that no-one in the group has
 * an anti-preference against the user.
 *
 * @param {string[]} antiPreferences The array of hyphenated anti-preference
 * combinations.
 * @param {string[]} group The array of group member usernames.
 * @param {string} username The username trying to join the group.
 * @return {boolean} Whether or not the user should attempt joining the group.
 */
let canTryJoiningGroup = function canJoinWithoutConflict(antiPreferences: string[], group: Group, username: Username): boolean {
    for (let i = 0; i < group.length; i++) {
        let hyphenatedCombination = [group[i], username].sort().join('-');

        if (antiPreferences.includes(hyphenatedCombination)) {
            return false;
        }
    }

    return true;
}

/**
 * Returns a score representing how acceptable a user is within a group. In other
 * words, this is the number of people in the group who listed them as a friend.
 *
 * @param {Object} preferences The preferences object, containing user choices.
 * @param {string[]} group The list of current group member usernames.
 * @param {string} member The member to find an acceptability score for.
 * @return {number} The acceptability score.
 */
let getGUScore = function getUserGroupScore(preferences: Preferences, group: Group, member: Username): number {
    let score = 0;

    for (let i = 0; i < group.length; i++) {
        let groupMember = group[i];
        if (preferences[groupMember].includes(member)) {
            score++;
        }
    }

    return score;
}

/**
 * Returns a group's ranking of acceptable users. In other words, returns the
 * order of users with the most people who listed them as friends in the group
 * (most accepted) to the least (least accepted).
 *
 * @param {Object} preferences The preferences object, containing user choices.
 * @param {string[]} group The list of potential group member usernames.
 * @return {string[]} The ranking of usernames, from most acceptable to least.
 */
let getGURanking = function findRankingOfGroupsByPreferences(preferences: Preferences, group: Group): Username[] {
    let scores = [];

    for (let i = 0; i < group.length; i++) {
        let score = getGUScore(preferences, group, group[i]);
        scores.push({ username: group[i], score, index: i });
    }

    return scores.sort((a, b) => {
        if (a.score === b.score) {
            // If they have the same exact score, go for the older member.
            return a.index - b.index;
        }

        // Otherwise, bigger score wins.
        return b.score - a.score;
    }).map((value) => {
        // Now that they're sorted, return just the member username.
        return value.username;
    });
}

/**
 * Converts an array of groups containing usernames into an array of groups
 * containing students' full names.
 *
 * @param {string[][]} groups The groups, each containing an array of usernames.
 * @param {Object} studentNames An object of usernames and their corresponding
 * student names.
 * @return {string[][]} The new group array with student names.
 */
let getGroupsWithNames = function getGroupsWithFullNames(
    groups: Group[],
    studentNames: { [username: string]: string }
): string[][] {
    return groups.map((group: Group) => {
        return group.map((username: Username) => {
            return studentNames[username];
        });
    });
}

/**
 * Returns the favorability metric of a group. This is the number of friendships
 * divided by the number of possible friendships.
 *
 * @param {string[]} group The array of member usernames.
 * @param {Object} preferences The preferences object.
 * @return {number} The favorability value.
 */
let getPercentFavorability = function getPercentFavorabilityForGroup(group: Group, preferences: Preferences): number {
    let currentFriendsSum = 0;

    for (let i = 0; i < group.length; i++) {
        for (let j = 0; j < group.length; j++) {
            if (preferences[group[i]] && preferences[group[i]].includes(group[j])) {
                currentFriendsSum++;
            }
        }
    }

    return currentFriendsSum / (group.length * (group.length - 1));
}

/**
 * Returns the fraction of a group that is male.
 *
 * @param {string[]} group The array of member usernames.
 * @param {Object} users The user details object.
 * @return {number} The gender ratio.
 */
let getGenderRadio = function getGenderRatioForGroup(group: Group, users: UserDetails): number {
    let currentMales = 0;

    for (let i = 0; i < group.length; i++) {
        if (users[group[i]].isMale) {
            currentMales++;
        }
    }

    return currentMales / group.length;
}

/**
 * Returns the lowest number of friends for any registered user in any group.
 * In other words, this is the minimum number of friends of any user who
 * listed preferences.
 *
 * @param {string[]} groups The array of groups to check.
 * @param {Object} preferences The preferences object to use when determining
 * friendship counts.
 * @return {Object} An object containing a `minFriends` key of the minimum
 * friends value and a `usernames` key containing all users with that number
 * of friends.
 */
let getMinFriends = function getMinimumFriendsScore(groups: Group[], preferences: Preferences): { minFriends: number; usernames: Username[] } {
    let currentMinFriends = Infinity;
    let currentUsersWithMinFriends: Username[] = [];

    for (let i = 0; i < groups.length; i++) {
        let group = groups[i];

        for (let j = 0; j < group.length; j++) {
            let username = group[j];

            // If they don't have preferences, they shouldn't be analyzed.
            if (!preferences[username]) {
                continue;
            }

            let friends = preferences[username];
            let currentFriendsCount = 0;

            for (let k = 0; k < group.length; k++) {
                if (friends.includes(group[k])) {
                    currentFriendsCount++;
                }
            }

            if (currentFriendsCount === currentMinFriends) {
                currentUsersWithMinFriends.push(username)
            }

            if (currentFriendsCount < currentMinFriends) {
                currentMinFriends = currentFriendsCount;
                currentUsersWithMinFriends = [username];
            }
        }
    }

    return { minFriends: currentMinFriends, usernames: currentUsersWithMinFriends };
}

/**
 * Returns a string representation of a percent value.
 *
 * @param {number} number The decimal value, from 0 to 1.
 * @return {string} The percentage representation.
 */
let getPercent = function getPercentString(number: number): string {
    return (number * 100).toFixed(2) + '%';
}


/**
 * Logs group results and statistics to the console.
 *
 * @param {string[][]} groups The array of created groups.
 * @param {Object} preferences The preferences object, to be used in statistics.
 * @param {Object} users The user details object, to be used in statistics.
 * @param {Object} details The program details object, to be used in statistics.
 * @param {Object} studentNames An object of usernames and their corresponding
 * student names.
 */
let output = function outputResults(
    groups: Group[],
    preferences: Preferences,
    users: UserDetails,
    details: { [key: string]: any },
    studentNames: { [username: string]: string }
): void {
    let percentFavorabilities = groups.map((group: Group) => {
        return getPercentFavorability(group, preferences);
    });

    let avgPercentFavorability = _.mean(percentFavorabilities)!;
    let maxPercentFavorability = _.max(percentFavorabilities)!;
    let minPercentFavorability = _.min(percentFavorabilities)!;

    let genderRatios = groups.map((group: Group) => {
        return getGenderRadio(group, users);
    });

    let avgGenderRatio = _.mean(genderRatios)!;
    let maxGenderRatio = _.max(genderRatios)!;
    let minGenderRatio = _.min(genderRatios)!;

    let currentPlacedCount = 0;
    let currentBiggestGroupSize = 0;
    let currentSmallestGroupSize = Infinity;

    for (let i = 0; i < groups.length; i++) {
        currentPlacedCount += groups[i].length;

        if (groups[i].length > currentBiggestGroupSize) {
            currentBiggestGroupSize = groups[i].length;
        }

        if (groups[i].length < currentSmallestGroupSize) {
            currentSmallestGroupSize = groups[i].length;
        }
    }

    let placedPercent = currentPlacedCount / Object.keys(users).length;
    let chosePercent = Object.keys(preferences).length / Object.keys(users).length;
    let minFriends = getMinFriends(groups, preferences);
    let groupsWithNames = getGroupsWithNames(groups, studentNames);

    console.log('### GROUPS: ###');
    console.log(groupsWithNames);
    console.log('### DETAILS: ###');
    console.log(' - Maximum Group Size');
    console.log(details.maxGroupSize);
    console.log(' - Group Count');
    console.log(details.groupAmount);
    console.log(' - User Count');
    console.log(Object.keys(users).length);
    console.log('### RESULTS: ###');
    console.log(' - Biggest Group Size');
    console.log(currentBiggestGroupSize);
    console.log(' - Smallest Group Size');
    console.log(currentSmallestGroupSize);
    console.log('### STATS: ###');
    console.log(' - Placed %');
    console.log(getPercent(placedPercent));
    console.log(' - Chosen %');
    console.log(getPercent(chosePercent));
    console.log(' - Avg favorability %');
    console.log(getPercent(avgPercentFavorability));
    console.log(' - Max favorability %');
    console.log(getPercent(maxPercentFavorability));
    console.log(' - Min favorability %');
    console.log(getPercent(minPercentFavorability));
    console.log(' - Min friends')
    console.log(minFriends.minFriends);
    console.log(' - Min friends users')
    console.log(minFriends.usernames.join(' '));
    console.log(' - Avg male %');
    console.log(getPercent(avgGenderRatio));
    console.log(' - Max male %');
    console.log(getPercent(maxGenderRatio));
    console.log(' - Min male %');
    console.log(getPercent(minGenderRatio));
}


/**
 * Runs the main algorithm process.
 *
 * @param {Promise<Object>} preferencesPromise A promise of user
 * preferences, where keys are usernames and values are arrays of friend usernames.
 * @param {Promise<Object>} usersPromise A promise of user details,
 * where keys are usernames and values are user details such as `isMale` and
 * `grade`.
 * @param {Promise<string[]>} antiPreferencesPromise A promise of user pairs that
 * cannot be paired together. The format is the usernames in alphebetical order
 * hyphenated.
 * @param {number} runID The ID for this algorithm run, which is used for
 * debugging purposes.
 * @return {Promise<Object>} A promise of an object with keys `groups`, `preferences`,
 * and `users`, where `groups` is the array of member arrays for each group,
 * `preferences` is the result of `preferencesPromise`, and `users` is the result
 * of usersPromise.
 */
let run = function runAlgorithmOnce(preferencesPromise: Promise<Preferences>, antiPreferencesPromise: Promise<string[]>, usersPromise: Promise<UserDetails>, runID: number): Promise<RunResult> {
    return Promise.all([preferencesPromise, usersPromise, antiPreferencesPromise]).then((results) => {
        // `preferences` may be incomplete for users who haven't filled out the form,
        // but `users` will always be complete.
        let preferences = results[0];
        let users = results[1];
        let antiPreferences = results[2];
        let totalUsersCount = Object.keys(users).length

        // These maximum values are not actually the largest number of users
        // allowed per group; rather, they are the maximum amount to initially
        // fill in when doing user rankings and placements. `unfittingUsers`
        // is the amount of users with preferences who couldn't be fit initially
        // and must be added later alongside users without any preferences.
        let maxGroupSize = Math.floor(totalUsersCount / groupAmount);
        let maxGroupGenderSize = Math.floor ((totalUsersCount / groupAmount) / 2);

        // For now, just focus on listed preferences, since users who filled out the ranking
        // should get priority over those who didn't
        let usernames = Object.keys(preferences);
        let allUsernames = Object.keys(users);
        let userOrder = _.shuffle(usernames);

        // Groups start out empty.
        let groups = [];

        for (let i = 0; i < groupAmount; i++) {
            groups.push([]);
        }

        let placedUsers: Username[] = [];
        let hasUpdatedThisLoop = false;

        // Loop through given users until the best matches are made.
        for (let i = 0; i < userOrder.length; i++) {
            let username = userOrder[i];
            let user = users[username];

            if (placedUsers.includes(username)) {
                continue;
            }

            let ugRanked = getUGRanking(preferences, groups, username);

            ugRankLoop: for (let j = 0; j < ugRanked.length; j++) {
                let groupID = ugRanked[j];

                // If it can't join because of an anti-preference, continue
                // with the next attempt.
                if (!canTryJoiningGroup(antiPreferences, groups[groupID], username)) {
                    continue ugRankLoop;
                }

                let guRanked = getGURanking(preferences, groupWithNew(groups[groupID], username));
                groups[groupID] = guRanked;
                placedUsers.push(username);

                // If we're at the maximum, we have to remove the least-liked user
                // of the same gender as the user we just added. This is potentially
                // the same user as the new one.
                if (hasMaximum(guRanked, user.isMale, maxGroupSize, maxGroupGenderSize, users)) {
                    for (let k = guRanked.length - 1; k >= 0; k--) {
                        if (users[guRanked[k]].isMale === user.isMale) {
                            let removedUser = guRanked[k];
                            guRanked.splice(k, 1);

                            _.remove(placedUsers, (placedUser) => {
                                return placedUser === removedUser
                            });

                            if (username === removedUser) {
                                continue ugRankLoop;
                            }

                            hasUpdatedThisLoop = true;
                            break ugRankLoop;
                        }
                    }
                }

                hasUpdatedThisLoop = true;
                break ugRankLoop;
            }

            // If there was a change in the last loop, it's possible there will
            // be another in this one. If there was no change, then there can't
            // be one this time either.
            if (i === userOrder.length - 1 && placedUsers.length < userOrder.length && hasUpdatedThisLoop) {
                hasUpdatedThisLoop = false;
                i = -1;
            }
        }

        // Loop through all unplaced users, including both those who didn't list
        // preferences as well as the few who couldn't even be fit within
        // the initial maximum limits.
        allUsernamesLoop: for (let i = 0; i < allUsernames.length; i++) {
            if (placedUsers.includes(allUsernames[i])) {
                continue;
            }

            // Sort the groups by size, so that smaller groups are tried first
            // before larger ones get filled. This prevents the same groups.
            // from filling at the end and getting disproportionately larger.
            // If there are ties, break them by the number of friends in the group.
            let sizeSortedGroups = _.sortBy(groups, [
                (group) => {
                    return group.length;
                },
                (group) => {
                    if (!preferences[allUsernames[i]]) {
                        return 0;
                    }

                    return getUGScore(preferences, group, allUsernames[i]);
                },
            ]) as Group[];

            // Loop through all groups 3 times. The first time, check if they have
            // space, ignoring preference. Next, check if they have space ignoring
            // preference and gender. Finally, check ignoring all constraints.
            for (let j = 0; j < sizeSortedGroups.length * 3; j++) {
                let effectiveGenderSize = j < sizeSortedGroups.length ? maxGroupGenderSize : Infinity;
                let effectiveGroupSize = j < sizeSortedGroups.length * 2 ? maxGroupSize : Infinity;

                if (!canTryJoiningGroup(antiPreferences, sizeSortedGroups[j % 3], allUsernames[i])) {
                    continue;
                }

                if (hasMaximum(sizeSortedGroups[j % 3], users[allUsernames[i]].isMale, effectiveGroupSize, effectiveGenderSize, users)) {
                    continue;
                }

                // Theoretically, adding regardless of preference here isn't ideal.
                // However, since the only users who aren't placed are those who
                // have the lowest GU scores anyway, it makes sense that they would have
                // less choice in the decision-making. Also, randomness makes
                // this more "fair" as well.
                sizeSortedGroups[j % 3].push(allUsernames[i]);
                continue allUsernamesLoop;
            }
        }

        if (debugEachCompletion) {
            console.log('Iteration ' + runID + ' has been completed.');
        }

        return {
            groups,
            preferences,
            users,
            details: {
                maxGroupSize,
                maxGroupGenderSize,
                groupAmount,
            },
        };
    });
}

/**
 * Runs the main algorithm process asynchronously multiple times, and finds
 * the best combination of groups. This combination is outputted.
 *
 * @return {Promise} A promise that resolves when the best group has been found.
 */
let runMany = function runAlgorithmAndFindBest(runAmount: number): Promise<void> {
    let runningPromises = [];

    for (let i = 0; i < runAmount; i++) {
        runningPromises.push(run(preferencesPromise, antiPreferencesPromise, usersPromise, i));
    }

    return Promise.all(runningPromises).then((results) => {
        // Sort by the minimum friends number, the number of usernames with that
        // number, and finally the minimum favorability percent for finding the
        // "best."
        let bestResult = _.sortBy(results, [
            (result: RunResult) => {
                let minFriends = getMinFriends(result.groups, result.preferences);
                return minFriends.minFriends;
            },
            (result: RunResult) => {
                let minFriends = getMinFriends(result.groups, result.preferences);
                return minFriends.usernames.length;
            },
            (result: RunResult) => {
                // The minimum percent favorability should be as high as
                // possible, so it should be negative.
                let percentFavorabilities = result.groups.map((group: Group) => {
                    return getPercentFavorability(group, result.preferences);
                });
                return -_.min(percentFavorabilities)!;
            },
        ])[0];

        studentNamesPromise.then((students: { [username: string]: string }) => {
            output(bestResult.groups, bestResult.preferences, bestResult.users, bestResult.details, students);
        });
    });
}

runMany(runAmount);
