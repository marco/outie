export interface Grade {
    students: {
        [username: string]: string;
    };
    antiPreferences: string[];
}

export interface Grades {
    [gradeID: string]: Grade;
}

export interface UserRecord {
    grade: string;
    isMale: boolean;
    isAdmin: boolean;
}

export interface UserRecords {
    [username: string]: UserRecord;
}
