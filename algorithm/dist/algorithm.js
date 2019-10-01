"use strict";
exports.__esModule = true;
var databaseSource = require("./database");
var _ = require("lodash");
var ProgressBar = require("progress");
var yargs = require("yargs");
var MOVE_ON_COUNT = 100;
var MAX_RUN_POWER = 6.3;
var PROGRESS_WIDTH = 40;
var database = databaseSource.get();
var gradeName = yargs.argv.grade;
var groupSizesArgument = yargs.argv.sizes;
var runAmountPower = yargs.argv.power;
var runAmount = Math.floor(Math.pow(10, runAmountPower));
var oneGenderGroups = yargs.argv.ignoreGender === 'true';
var useUsernames = yargs.argv.useUsernames === 'true';
var db = database.firestore();
if (runAmountPower > MAX_RUN_POWER) {
    console.error(runAmountPower + ' is not a vailid run power. The maximum value is ' + MAX_RUN_POWER + '.');
    process.exit(1);
}
var preferencesPromise = db.collection('preferences').doc(gradeName).get().then(function (snapshot) {
    return snapshot.data() || {};
});
var antiPreferencesPromise = db.collection('anti-preferences').doc(gradeName).get().then(function (snapshot) {
    return snapshot.data().antiPreferences || [];
});
var studentNamesPromise = db.collection('grades').doc(gradeName).get().then(function (snapshot) {
    return {}; // snapshot.data()!.students || {};
});
var usersPromise = db.collection('user-records').get().then(function (snapshot) {
    var users = {};
    var docs = snapshot.docs;
    docs.forEach(function (doc) {
        if (!doc.data().grade || doc.data().grade !== gradeName) {
            return;
        }
        users[doc.id] = doc.data();
    });
    return users;
})["catch"](function (error) {
    /* eslint-disable-next-line no-console */
    console.log(error);
});
/**
 * Returns an ordered array of descending group sizes.
 *
 * @param {string} argument The command-line argument to parse.
 * @return {number[]} The array of group sizes.
 */
var getGroupSizes = function getGroupSizesForArgument(argument) {
    return argument.split('-').map(function (size) { return parseInt(size); }).sort(function (a, b) { return b - a; });
};
/**
 * Creates a group with a new member.
 *
 * @param {string[]} group The old list of usernames.
 * @param {string} member The new username to add.
 * @return {string[]} The new list of usernames.
 */
var groupWithNew = function copyGroupWithNewMember(group, member) {
    var newGroup = group.slice();
    newGroup.push(member);
    return newGroup;
};
/**
 * Returns the number of users present within a single username. For example,
 * the user "mburstein2021" would have a multiplicity of 1, since there is only
 * one user. However, the joint-user "mburstein2021-auser2021--x2" has a
 * multiplicity of 2. Currently, only multipliers 1 and 2 are supported.
 *
 * @param username The username of the user to find the multiplier for.
 * @returns The multiplier value.
 */
var getMultiplier = function getMultiplierForUsername(username) {
    if (username.endsWith("--x5")) {
        return 5;
    }
    if (username.endsWith("--x4")) {
        return 4;
    }
    if (username.endsWith("--x3")) {
        return 3;
    }
    if (username.endsWith("--x2")) {
        return 2;
    }
    return 1;
};
var getAllMultiplier = function getMultiplierSumForUsernames(usernames) {
    return usernames.reduce(function (sum, username) { return sum + getMultiplier(username); }, 0);
};
/**
 * Checks whether a group has overflowed its maximum number of a certain gender,
 * and therefore must have a member removed.
 *
 * @param {string[]} group The list of usernames to check.
 * @param {boolean} isMale Whether the gender to check is male.
 * @param {number} maxAmount The maximum number of members to allow in the group.
 * @param {number} maxAmountSame The maximum number of the same gender to allow.
 * @param {Object} users The user detail object, containing information for usernames.
 * @param {boolean} oneGender Whether or not this group should be one-gendered.
 * If not one-gendered, then the group will use `maxAmountSame` to determine
 * eligibility.
 * @return {boolean} Whether or not it has reached the maximum.
 */
var hasMaximum = function checkGenderHasMaximum(group, isMale, maxAmount, maxAmountSame, oneGender, users) {
    var currentAmountSame = 0;
    var currentAmount = 0;
    for (var i = 0; i < group.length; i++) {
        currentAmount += getMultiplier(group[i]);
        if (users[group[i]].isMale === isMale) {
            currentAmountSame += getMultiplier(group[i]);
        }
    }
    if (oneGender) {
        // If it's a one-gender group, assume there is only one gender anyway
        // so don't check the same-gender amount.
        return currentAmount > maxAmount;
    }
    // Add one to the amounts, since if a new user is added it should still
    // be checked.
    return currentAmountSame > maxAmountSame || currentAmount > maxAmount;
};
/**
 * Returns a score representing how much a user likes a group. In other words,
 * this is the number of friends that the user has in the group.
 *
 * @param {Object} preferences The preferences object, containing user choices.
 * @param {string[]} group The list of current group member usernames.
 * @param {string} member The member to find an favorability score for.
 * @return {number} The favorability score.
 */
var getUGScore = function getUserGroupScore(preferences, group, member) {
    var score = 0;
    for (var i = 0; i < group.length; i++) {
        var groupMember = group[i];
        if (preferences[member].includes(groupMember)) {
            score += getMultiplier(groupMember);
        }
    }
    return score;
};
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
var getUGRanking = function findRankingOfGroupsByPreferences(preferences, groups, newMember) {
    var scores = [];
    for (var i = 0; i < groups.length; i++) {
        var score = getUGScore(preferences, groups[i], newMember);
        scores.push({ groupID: i, score: score });
    }
    return scores.sort(function (a, b) {
        if (a.score === b.score) {
            // If they have the same exact score, go for the one with more members.
            // If they have the same number of members, pick randomly.
            var lengthDifference = groups[b.groupID].length - groups[a.groupID].length;
            if (lengthDifference === 0) {
                return _.sample([-1, 1]);
            }
            return lengthDifference;
        }
        // Otherwise, bigger score wins.
        return b.score - a.score;
    }).map(function (value) {
        // Now that they're sorted, return just the group ID.
        return value.groupID;
    });
};
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
var canTryJoiningGroup = function canJoinWithoutConflict(antiPreferences, group, username) {
    for (var i = 0; i < group.length; i++) {
        var hyphenatedCombination = [group[i], username].sort().join('__');
        if (antiPreferences.includes(hyphenatedCombination)) {
            return false;
        }
    }
    return true;
};
/**
 * Returns a score representing how acceptable a user is within a group. In other
 * words, this is the number of people in the group who listed them as a friend.
 *
 * @param {Object} preferences The preferences object, containing user choices.
 * @param {string[]} group The list of current group member usernames.
 * @param {string} member The member to find an acceptability score for.
 * @return {number} The acceptability score.
 */
var getGUScore = function getUserGroupScore(preferences, group, member) {
    var score = 0;
    for (var i = 0; i < group.length; i++) {
        var groupMember = group[i];
        if (preferences[groupMember].includes(member)) {
            score += getMultiplier(member) * getMultiplier(groupMember);
        }
    }
    return score;
};
/**
 * Returns a group's ranking of acceptable users. In other words, returns the
 * order of users with the most people who listed them as friends in the group
 * (most accepted) to the least (least accepted).
 *
 * @param {Object} preferences The preferences object, containing user choices.
 * @param {string[]} group The list of potential group member usernames.
 * @return {string[]} The ranking of usernames, from most acceptable to least.
 */
var getGURanking = function findRankingOfGroupsByPreferences(preferences, group) {
    var scores = [];
    for (var i = 0; i < group.length; i++) {
        var score = getGUScore(preferences, group, group[i]);
        scores.push({ username: group[i], score: score, index: i });
    }
    return scores.sort(function (a, b) {
        if (a.score === b.score) {
            // If they have the same exact score, go for the older member.
            return a.index - b.index;
        }
        // Otherwise, bigger score wins.
        return b.score - a.score;
    }).map(function (value) {
        // Now that they're sorted, return just the member username.
        return value.username;
    });
};
/**
 * Converts an array of groups containing usernames into an array of groups
 * containing students' full names.
 *
 * @param {string[][]} groups The groups, each containing an array of usernames.
 * @param {Object} studentNames An object of usernames and their corresponding
 * student names.
 * @return {string[][]} The new group array with student names.
 */
var getGroupsWithNames = function getGroupsWithFullNames(groups, studentNames) {
    return groups.map(function (group) {
        return group.map(function (username) {
            return useUsernames ? username : studentNames[username];
        });
    });
};
/**
 * Returns the favorability metric of a group. This is the number of friendships
 * divided by the number of possible friendships.
 *
 * @param {string[]} group The array of member usernames.
 * @param {Object} preferences The preferences object.
 * @return {number} The favorability value.
 */
var getPercentFavorability = function getPercentFavorabilityForGroup(group, preferences) {
    // If it's an empty group, then instead of returning NaN, treat
    // as a "perfect" group.
    if (group.length === 0) {
        return 1;
    }
    var currentFriendsSum = 0;
    for (var i = 0; i < group.length; i++) {
        for (var j = 0; j < group.length; j++) {
            if (preferences[group[i]] && preferences[group[i]].includes(group[j])) {
                currentFriendsSum += getMultiplier(group[i]) * getMultiplier(group[j]);
            }
        }
    }
    return currentFriendsSum / ((getAllMultiplier(group) - 1) * (getAllMultiplier(group) - 1) * 2);
};
/**
 * Returns the fraction of a group that is male.
 *
 * @param {string[]} group The array of member usernames.
 * @param {Object} users The user details object.
 * @return {number} The gender ratio.
 */
var getGenderRadio = function getGenderRatioForGroup(group, users) {
    var currentMales = 0;
    for (var i = 0; i < group.length; i++) {
        if (users[group[i]].isMale) {
            currentMales++;
        }
    }
    return currentMales / group.length;
};
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
var getMinFriends = function getMinimumFriendsScore(groups, preferences) {
    var currentMinFriends = Infinity;
    var currentUsersWithMinFriends = [];
    for (var i = 0; i < groups.length; i++) {
        var group = groups[i];
        for (var j = 0; j < group.length; j++) {
            var username = group[j];
            // If they don't have preferences, they shouldn't be analyzed.
            if (!preferences[username]) {
                continue;
            }
            var friends = preferences[username];
            var currentFriendsCount = 0;
            for (var k = 0; k < group.length; k++) {
                if (friends.includes(group[k])) {
                    currentFriendsCount++;
                }
            }
            if (currentFriendsCount === currentMinFriends) {
                currentUsersWithMinFriends.push(username);
            }
            if (currentFriendsCount < currentMinFriends) {
                currentMinFriends = currentFriendsCount;
                currentUsersWithMinFriends = [username];
            }
        }
    }
    return { minFriends: currentMinFriends, usernames: currentUsersWithMinFriends };
};
/**
 * Returns a string representation of a percent value.
 *
 * @param {number} number The decimal value, from 0 to 1.
 * @return {string} The percentage representation.
 */
var getPercent = function getPercentString(number) {
    return (number * 100).toFixed(2) + '%';
};
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
var output = function outputResults(groups, preferences, users, details, studentNames) {
    var percentFavorabilities = groups.map(function (group) {
        return getPercentFavorability(group, preferences);
    });
    var avgPercentFavorability = _.mean(percentFavorabilities);
    var maxPercentFavorability = _.max(percentFavorabilities);
    var minPercentFavorability = _.min(percentFavorabilities);
    var genderRatios = groups.map(function (group) {
        return getGenderRadio(group, users);
    });
    var avgGenderRatio = _.mean(genderRatios);
    var maxGenderRatio = _.max(genderRatios);
    var minGenderRatio = _.min(genderRatios);
    var currentPlacedCount = 0;
    var currentBiggestGroupSize = 0;
    var currentSmallestGroupSize = Infinity;
    for (var i = 0; i < groups.length; i++) {
        currentPlacedCount += groups[i].length;
        if (getAllMultiplier(groups[i]) > currentBiggestGroupSize) {
            currentBiggestGroupSize = groups[i].length;
        }
        if (getAllMultiplier(groups[i]) < currentSmallestGroupSize) {
            currentSmallestGroupSize = groups[i].length;
        }
    }
    var placedPercent = currentPlacedCount / Object.keys(users).length;
    var chosePercent = Object.keys(preferences).length / Object.keys(users).length;
    var minFriends = getMinFriends(groups, preferences);
    var groupsWithNames = getGroupsWithNames(groups, studentNames);
    /* eslint-disable no-console */
    console.log('### GROUPS: ###');
    console.log(groupsWithNames.map(function (group) { return [getAllMultiplier(group), group]; }));
    console.log('### DETAILS: ###');
    console.log(' - Group Amount');
    console.log(details.groupAmount);
    console.log(' - Available Group Sizes');
    console.log(details.groupSizes);
    console.log(' - Actual Group Sizes');
    console.log(groups.map(function (group) { return getAllMultiplier(group); }).sort(function (a, b) { return b - a; }));
    console.log(' - User Count');
    console.log(getAllMultiplier(Object.keys(users)));
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
    console.log(' - Min friends');
    console.log(minFriends.minFriends);
    console.log(' - Min friends users');
    console.log(minFriends.usernames.join(' '));
    console.log(' - Avg male %');
    console.log(getPercent(avgGenderRatio));
    console.log(' - Max male %');
    console.log(getPercent(maxGenderRatio));
    console.log(' - Min male %');
    console.log(getPercent(minGenderRatio));
    /* eslint-enable no-console */
};
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
var run = function runAlgorithmOnce(preferencesPromise, antiPreferencesPromise, usersPromise, runID, progressBar) {
    return Promise.all([preferencesPromise, usersPromise, antiPreferencesPromise]).then(function (results) {
        // `preferences` may be incomplete for users who haven't filled out the form,
        // but `users` will always be complete.
        var preferences = results[0];
        var users = results[1];
        var antiPreferences = results[2];
        var totalUsersCount = getAllMultiplier(Object.keys(users));
        var groupSizes = getGroupSizes(groupSizesArgument);
        // For now, just focus on listed preferences, since users who filled out the ranking
        // should get priority over those who didn't
        var usernames = Object.keys(preferences);
        var allUsernames = Object.keys(users);
        var userOrder = _.shuffle(usernames);
        // Groups start out empty.
        var groups = [];
        for (var i = 0; i < groupSizes.length; i++) {
            groups.push([]);
        }
        var placedUsers = [];
        var hasUpdatedThisLoop = false;
        var currentLoopAmounts = 0;
        // Loop through given users until the best matches are made.
        for (var i = 0; i < userOrder.length; i++) {
            var username = userOrder[i];
            var user = users[username];
            if (placedUsers.includes(username)) {
                continue;
            }
            var ugRanked = getUGRanking(preferences, groups, username);
            ugRankLoop: for (var j = 0; j < ugRanked.length; j++) {
                var groupID = ugRanked[j];
                // If it can't join because of an anti-preference, continue
                // with the next attempt.
                if (!canTryJoiningGroup(antiPreferences, groups[groupID], username)) {
                    continue ugRankLoop;
                }
                var guRanked = getGURanking(preferences, groupWithNew(groups[groupID], username));
                groups[groupID] = guRanked;
                placedUsers.push(username);
                // If we're at the maximum, we have to remove the least-liked user
                // of the same gender as the user we just added. This is potentially
                // the same user as the new one.
                if (hasMaximum(guRanked, user.isMale, groupSizes[groupID], Math.floor(groupSizes[groupID] / 2), oneGenderGroups, users)) {
                    var currentRemovedUsers = 0;
                    var _loop_1 = function (k) {
                        if (users[guRanked[k]].isMale === user.isMale) {
                            var removedUser_1 = guRanked[k];
                            guRanked.splice(k, 1);
                            currentRemovedUsers += getMultiplier(removedUser_1);
                            _.remove(placedUsers, function (placedUser) {
                                return placedUser === removedUser_1;
                            });
                            // If enough users have been removed to cancel-out
                            // the new ones, continue with the next step.
                            // Otherwise, keep removing another user.
                            if (currentRemovedUsers >= getMultiplier(username)) {
                                if (username === removedUser_1) {
                                    return "continue-ugRankLoop";
                                }
                                hasUpdatedThisLoop = true;
                                return "break-ugRankLoop";
                            }
                        }
                    };
                    for (var k = guRanked.length - 1; k >= 0; k--) {
                        var state_1 = _loop_1(k);
                        switch (state_1) {
                            case "break-ugRankLoop": break ugRankLoop;
                            case "continue-ugRankLoop": continue ugRankLoop;
                        }
                    }
                }
                hasUpdatedThisLoop = true;
                break ugRankLoop;
            }
            // If there was a change in the last loop, it's possible there will
            // be another in this one. If there was no change, then there can't
            // be one this time either.
            if (i === userOrder.length - 1 && placedUsers.length < userOrder.length && hasUpdatedThisLoop && currentLoopAmounts < MOVE_ON_COUNT) {
                hasUpdatedThisLoop = false;
                i = -1;
                currentLoopAmounts++;
            }
        }
        var _loop_2 = function (i) {
            if (placedUsers.includes(allUsernames[i])) {
                return "continue";
            }
            // Sort the groups by the number of remaining spots, so that less-full
            //  groups are tried first before more-full ones. This prevents the same groups.
            // from filling at the end and getting disproportionately larger.
            // If there are ties, break them by the number of friends in the group.
            var sizeSortedGroups = _.sortBy(_.zip(groups, groupSizes), [
                function (groupZip) {
                    return getAllMultiplier(groupZip[0]) - groupZip[1];
                },
                function (group) {
                    if (!preferences[allUsernames[i]]) {
                        return 0;
                    }
                    return getUGScore(preferences, group, allUsernames[i]);
                },
            ]).map(function (groupZip) { return groupZip[0]; });
            // Loop through all groups 3 times. The first time, check if they have
            // space, ignoring preference. Next, check if they have space ignoring
            // preference and gender. Finally, check ignoring all constraints.
            for (var j = 0; j < sizeSortedGroups.length * 3; j++) {
                var effectiveGenderSize = j < sizeSortedGroups.length ? Math.floor(groupSizes[j] / 2) : Infinity;
                var effectiveGroupSize = j < sizeSortedGroups.length * 2 ? groupSizes[j] : Infinity;
                if (!canTryJoiningGroup(antiPreferences, sizeSortedGroups[j % sizeSortedGroups.length], allUsernames[i])) {
                    continue;
                }
                if (hasMaximum(sizeSortedGroups[j % sizeSortedGroups.length], users[allUsernames[i]].isMale, effectiveGroupSize, effectiveGenderSize, oneGenderGroups, users)) {
                    continue;
                }
                // Theoretically, adding regardless of preference here isn't ideal.
                // However, since the only users who aren't placed are those who
                // have the lowest GU scores anyway, it makes sense that they would have
                // less choice in the decision-making. Also, randomness makes
                // this more "fair" as well.
                sizeSortedGroups[j % sizeSortedGroups.length].push(allUsernames[i]);
                return "continue-allUsernamesLoop";
            }
        };
        // Loop through all unplaced users, including both those who didn't list
        // preferences as well as the few who couldn't even be fit within
        // the initial maximum limits.
        allUsernamesLoop: for (var i = 0; i < allUsernames.length; i++) {
            var state_2 = _loop_2(i);
            switch (state_2) {
                case "continue-allUsernamesLoop": continue allUsernamesLoop;
            }
        }
        progressBar.tick();
        return {
            groups: groups,
            preferences: preferences,
            users: users,
            details: {
                groupSizes: groupSizes,
                groupAmount: groupSizes.length
            }
        };
    });
};
/**
 * Runs the main algorithm process asynchronously multiple times, and finds
 * the best combination of groups. This combination is outputted.
 *
 * @return {Promise} A promise that resolves when the best group has been found.
 */
var runMany = function runAlgorithmAndFindBest(runAmount) {
    var runningPromises = [];
    var progressBar = new ProgressBar('Working… [:bar] :rate/s :percent :etas', {
        complete: '=',
        head: '>',
        incomplete: ' ',
        width: PROGRESS_WIDTH,
        total: runAmount
    });
    for (var i = 0; i < runAmount; i++) {
        runningPromises.push(run(preferencesPromise, antiPreferencesPromise, usersPromise, i, progressBar));
    }
    return Promise.all(runningPromises).then(function (results) {
        // Sort by the minimum friends number, the number of usernames with that
        // number, and finally the minimum favorability percent for finding the
        // "best."
        var bestResult = _.sortBy(results, [
            function (result) {
                var minFriends = getMinFriends(result.groups, result.preferences);
                return minFriends.minFriends;
            },
            function (result) {
                var minFriends = getMinFriends(result.groups, result.preferences);
                return minFriends.usernames.length;
            },
            function (result) {
                // The minimum percent favorability should be as high as
                // possible, so it should be negative.
                var percentFavorabilities = result.groups.map(function (group) {
                    return getPercentFavorability(group, result.preferences);
                });
                return -_.min(percentFavorabilities);
            },
        ])[0];
        studentNamesPromise.then(function (students) {
            output(bestResult.groups, bestResult.preferences, bestResult.users, bestResult.details, students);
        });
    });
};
runMany(runAmount);
