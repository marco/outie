# Algorithm Specification

 - Make an arbitrary number of empty "groups."
 - Randomly loop through students repeatedly
    - Look at their listed friends and compare them to students in each of
      the groups, giving each a score based on the number of common friends.
    - The student is tentatively assigned to the group with the highest score.
       - Ties are broken by the group with the lower number of people in it.
       - If a group is already full, they must tie-break with other tentative members.
          - If they are less well-liked by the group than others, they must
            make a new choice. (The only potential problem here is that the group's
            decision now might be different from their decision when filled
            with more members, which is why randomness is fair.)
          - Otherwise, another tentative student loses their choice. They will
            re-choose when re-looped.
    - Once all people have been assigned, the groups are done.
