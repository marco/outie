<div align="center">
  <img src="./outie-logo.png" width="50%">
</div>

Outie is the group-making algorithm and web server for [Chadwick School's Outdoor Ed
program](https://www.chadwickschool.org/student-life/outdoor-ed). It contains
a frontend using React, Webpack, and Sass as well as a backend using TypeScript
and Firebase.

## Installation

 1. After cloning the project, install all required dependencies with `npm install`.

 2. Configure Firebase. Add the `server/config/firebase-service-key.json` file
    containing administration credentials, and add a
    `web/src/config/firebase.json` file with web details.

 3. Compile the web server using `npm run build` and the algorithm files using
    `npm run compile`.

## Web Usage

The web server can be built and ran using:

```bash
npm run build && npm start
```

Additionally, a live-reloading development mode can be started with:

```bash
npm run listen
```

## Algorithm Usage

To run the algorithm, use `npm run compile` and then `npm run choose`. The
algorithm requires the following parameters, in order:

 1. The grade ID of the grade to generate groups for, e.g., `grade2021`.
 2. The number of groups to make, e.g., `13`.
 3. The iteration magnitude. The algorithm is ran 10<sup>x</sup> times, where
    *x* is this argument, e.g., `3`. More details are given in the "Algorithm
    Summary" section.
 4. Whether or not gender should be ignored when creating groups, e.g., `true`
    or `false`.
 5. Whether or not usernames should be outputted instead of full names when
    displaying results, e.g., `true` or `false`.
 6. Whether not to make the output "verbose," e.g., `--verbose` or `--concise`.

Here are some recommended parameters to get you started:

```bash
npm run compile && npm run choose -- gradeExample 13 3 false false --verbose
```

## Algorithm

The Outie algorithm is based on the
[Hospitals-Residents](https://youtu.be/kvgfgGmemdA) problem. In short, students
rank groups on their number of friends in that group, while
groups themselves "rank" potential students by how many people inside consider
them to be their friends. A more detailed explanation is shown below.

 - Start with completely empty groups.
 - Randomly loop through all students who listed preferences. Although this
   order plays an extremely small role in determining groups, it can have some
   impacts when there are "ties," so the order is randomized. When the iteration
   count is increased, the number of random attempts is increased as well.
    - Rank the groups in order from the one with the most of their friends to the
      least.
    - In this order, check if the groups are full.
       - If a group isn't, add the new user and move to the next user.
       - If is is full, check if the new user is more "well liked" than any
         other user in the group.
          - If not, try the user's next favorite group.
          - If they are, add them and remove the other user.
    - Continue looping through all registered users until all have been
      placed in a group, or there are no more spaces without exceeding the
      tentative maximum number of students per group.
 - Then, loop through all users who didn't register or couldn't be placed.
    - Sort all groups by least-populated to most-populated.
    - Loop through the groups in order.
       - If the student can be added without any gender or sizing conflicts,
         add them. Otherwise, keep looping.
    - If there are still remaining users, loop through groups again, now ignoring
      gender. Lastly, loop ignoring gender and group size to confirm all users
      are placed.
 - Once all users have been placed, the algorithm is complete. If multiple
   iterations were ran, find the one with the highest average friend ratio
   per group.
