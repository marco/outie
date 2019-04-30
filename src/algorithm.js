let database = require('../src/database.js').get();
let _ = require('lodash');

const GENDER_OFFSET = 0;
const TOTAL_OFFSET = 0;
const RUN_AMOUNT = 1;
let gradeName = process.argv[2];
let groupAmount = process.argv[3];

let db = database.firestore();

let preferencesPromise = db.collection('preferences').doc(gradeName).get().then((snapshot) => {
    return snapshot.data();
});

let usersPromise = db.collection('user-records').get().then((snapshot) => {
    let users = {};
    let docs = snapshot.docs;

    docs.forEach((doc) => {
        if (doc.data().grade) {
            if (doc.data().grade !== gradeName) {
                return;
            }
        }

        users[doc.id] = doc.data();
    })

    return users;
}, (error) => console.log(error)).catch((error) => console.log(error));

/**
 * Runs the main algorithm process.
 *
 * @param {Promise<Object>} preferencesPromise A promise of user
 * preferences, where keys are usernames and values are arrays of friend usernames.
 * @param {Promise<Object>} usersPromise A promise of user details,
 * where keys are usernames and values are user details such as `isMale` and
 * `grade`.
 * @return {Promise<Object>} A promise of an object with keys `groups`, `preferences`,
 * and `users`, where `groups` is the array of member arrays for each group,
 * `preferences` is the result of `preferencesPromise`, and `users` is the result
 * of usersPromise.
 */
let run = function runAlgorithmOnce(preferencesPromise, usersPromise) {
    return Promise.all([preferencesPromise, usersPromise]).then((results) => {
        // `preferences` may be incomplete for users who haven't filled out the form,
        // but `users` will always be complete.
        let preferences = results[0];
        let users = results[1];
        let totalUsersCount = Object.keys(users).length

        let maxGroupSize = Math.floor(totalUsersCount / groupAmount) + TOTAL_OFFSET;
        let maxGroupGenderSize = Math.floor((totalUsersCount / groupAmount) / 2) + GENDER_OFFSET;

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

        let placedUsers = [];

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

                let guRanked = getGURanking(preferences, groupWithNew(groups[groupID], username));
                groups[groupID] = guRanked;
                placedUsers.push(username);

                // If we're at the maximum, we have to remove the least-liked user
                // of the same gender as the user we just added. This is potentially
                // the same user as the new one.
                if (hasMaximum(guRanked, user.isMale, maxGroupSize, maxGroupGenderSize, users)) {
                    removedUserLoop: for (let k = guRanked.length - 1; k >= 0; k--) {
                        if (users[guRanked[k]].isMale === user.isMale) {
                            let removedUser = guRanked[k];
                            guRanked.splice(k, 1);

                            placedUsers = placedUsers.filter((placedUser) => {
                                return placedUser !== removedUser;
                            });

                            if (username === removedUser) {
                                continue ugRankLoop;
                            }

                            break ugRankLoop;
                        }
                    }
                }

                break ugRankLoop;
            }

            if (i === userOrder.length - 1 && placedUsers.length !== userOrder.length) {
                i = -1;
            }
        }

        allUsernamesLoop: for (let i = 0; i < allUsernames.length; i++) {
            if (placedUsers.includes(allUsernames[i])) {
                continue;
            }

            // Loop through all groups 3 times. The first time, check if they have
            // space, ignoring preference. Next, check if they have space ignoring
            // preference and gender. Finally, check ignoring all constraints.
            for (let j = 0; j < groups.length * 3; j++) {
                let effectiveGenderSize = j < groups.length ? maxGroupGenderSize : Infinity;
                let effectiveGroupSize = j < groups.length * 2 ? maxGroupSize : Infinity;

                if (hasMaximum(groups[j], users[allUsernames[i]].isMale, effectiveGroupSize, effectiveGenderSize, users)) {
                    continue;
                }

                // Theoretically, adding regardless of preference here isn't ideal.
                // However, since the only users who aren't placed are those who
                // have the lowest GU scores anyway, it makes sense that they would have
                // less choice in the decision-making. Also, randomness makes
                // this more "fair" as well.
                groups[j].push(allUsernames[i]);
                continue allUsernamesLoop;
            }
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
 * Creates a group with a new member.
 *
 * @param {string[]} group The old list of usernames.
 * @param {string} member The new username to add.
 * @return {string[]} The new list of usernames.
 */
let groupWithNew = function copyGroupWithNewMember(group, member) {
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
let hasMaximum = function checkGenderHasMaximum(group, isMale, maxAmount, maxAmountSame, users) {
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
 * Returns a user's ranking of group preferences. In other words, returns the
 * order of groups that contain the most of the user's friends (most favorite)
 * to the least (least favorite).
 *
 * @param {Object} preferences The preferences object, containing user choices.
 * @param {string[][]} groups The available groups to join. Each group is a list of member usernames.
 * @param {string} newMember The member choosing between group preferences.
 * @return {number[]} The ranking of group indices, from favorite to least.
 */
let getUGRanking = function findRankingOfGroupsByPreferences(preferences, groups, newMember) {
    let scores = [];

    for (let i = 0; i < groups.length; i++) {
        let score = getUGScore(preferences, groups[i], newMember);
        scores.push({ groupID: i, score });
    }

    return scores.sort((a, b) => {
        if (a.score === b.score) {
            // If they have the same exact score, go for the one with less members.
            // If they have the same number of members, pick randomly.
            let lengthDifference = groups[a.groupID].length - groups[b.groupID].length;

            if (lengthDifference === 0) {
                return _.sample([-1, 1]);
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
 * Returns a group's ranking of acceptable users. In other words, returns the
 * order of users with the most people who listed them as friends in the group
 * (most accepted) to the least (least accepted).
 *
 * @param {Object} preferences The preferences object, containing user choices.
 * @param {string[]} group The list of potential group member usernames.
 * @return {string[]} The ranking of usernames, from most acceptable to least.
 */
let getGURanking = function findRankingOfGroupsByPreferences(preferences, group) {
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
 * Returns a score representing how acceptable a user is within a group. In other
 * words, this is the number of people in the group who listed them as a friend.
 *
 * @param {Object} preferences The preferences object, containing user choices.
 * @param {string[]} group The list of current group member usernames.
 * @param {string} member The member to find an acceptability score for.
 * @return {number} The acceptability score.
 */
let getGUScore = function getUserGroupScore(preferences, group, member) {
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
 * Returns a score representing how much a user likes a group. In other words,
 * this is the number of friends that the user has in the group.
 *
 * @param {Object} preferences The preferences object, containing user choices.
 * @param {string[]} group The list of current group member usernames.
 * @param {string} member The member to find an favorability score for.
 * @return {number} The favorability score.
 */
let getUGScore = function getUserGroupScore(preferences, group, member) {
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
 * Logs group results and statistics to the console.
 *
 * @param {string[][]} groups The array of created groups.
 * @param {Object} preferences The preferences object, to be used in statistics.
 * @param {Object} users The user details object, to be used in statistics.
 * @param {Object} details The program details object, to be used in statistics.
 */
let output = function outputResults(groups, preferences, users, details) {
    let percentFavorabilities = groups.map((group) => {
        return getPercentFavorability(group, preferences);
    });

    let avgPercentFavorability = _.mean(percentFavorabilities);
    let maxPercentFavorability = _.max(percentFavorabilities);
    let minPercentFavorability = _.min(percentFavorabilities);

    let genderRatios = groups.map((group) => {
        return getGenderRadio(group, users);
    });

    let avgGenderRatio = _.mean(genderRatios);
    let maxGenderRatio = _.max(genderRatios);
    let minGenderRatio = _.min(genderRatios);

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

    console.log('### GROUPS: ###');
    console.log(groups);
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
    console.log(' - Avg male %');
    console.log(getPercent(avgGenderRatio));
    console.log(' - Max male %');
    console.log(getPercent(maxGenderRatio));
    console.log(' - Min male %');
    console.log(getPercent(minGenderRatio));
}

/**
 * Returns the favorability metric of a group. This is the number of friendships
 * divided by the number of possible friendships.
 *
 * @param {string[]} group The array of member usernames.
 * @param {Object} preferences The preferences object.
 * @return {number} The favorability value.
 */
let getPercentFavorability = function getPercentFavorabilityForGroup(group, preferences) {
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
let getGenderRadio = function getGenderRatioForGroup(group, users) {
    let currentMales = 0;

    for (let i = 0; i < group.length; i++) {
        if (users[group[i]].isMale) {
            currentMales++;
        }
    }

    return currentMales / group.length;
}

/**
 * Returns a string representation of a percent value.
 *
 * @param {number} number The decimal value, from 0 to 1.
 * @return {string} The percentage representation.
 */
let getPercent = function getPercentString(number) {
    return (number * 100).toFixed(2) + '%';
}

/**
 * Runs the main algorithm process asynchronously multiple times, and finds
 * the best combination of groups. This combination is outputted.
 *
 * @return {Promise} A promise that resolves when the best group has been found.
 */
let runMany = function runAlgorithmAndFindMest() {
    let runningPromises = [];

    for (let i = 0; i < RUN_AMOUNT; i++) {
        runningPromises.push(run(preferencesPromise, usersPromise));
    }

    return Promise.all(runningPromises).then((results) => {
        let currentBestMPF = -1;
        let currentBestIndex;

        for (let i = 0; i < results.length; i++) {
            let result = results[i];

            let percentFavorabilities = result.groups.map((group) => {
                return getPercentFavorability(group, result.preferences);
            });

            let minPercentFavorability = _.min(percentFavorabilities);
            if (minPercentFavorability > currentBestMPF) {
                currentBestMPF = minPercentFavorability;
                currentBestIndex = i;
            }
        }

        let finalResult = results[currentBestIndex];
        output(finalResult.groups, finalResult.preferences, finalResult.users, finalResult.details);
    });
}

runMany();
