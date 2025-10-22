/** @format */

import { describe, it, expect, beforeEach } from "vitest";
import { stringAsciiCV, uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 1000;
const ERR_INVALID_GRADE = 1001;
const ERR_ALREADY_ISSUED = 1002;
const ERR_NO_ENROLLMENT = 1003;
const ERR_ASSESSMENT_FAILED = 1004;
const ERR_INVALID_COURSE = 1005;
const ERR_CREDENTIAL_REVOKED = 1006;
const ERR_INVALID_HASH = 1007;
const ERR_COURSE_NOT_ACTIVE = 1008;
const ERR_GRADE_THRESHOLD = 1009;

interface Credential {
  recipient: string;
  courseId: number;
  issuer: string;
  issueDate: number;
  grade: number;
  assessmentHash: string;
  status: boolean;
}

interface CourseIssuer {
  institution: string;
  active: boolean;
  maxCredentials: number;
  issuedCount: number;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class CredentialIssuanceMock {
  state: {
    passingGrade: number;
    nextCredentialId: number;
    issuerAuthority: string | null;
    credentials: Map<number, Credential>;
    courseIssuers: Map<number, CourseIssuer>;
    studentCredentials: Map<string, number>;
  } = {
    passingGrade: 70,
    nextCredentialId: 0,
    issuerAuthority: null,
    credentials: new Map(),
    courseIssuers: new Map(),
    studentCredentials: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1INST";

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      passingGrade: 70,
      nextCredentialId: 0,
      issuerAuthority: null,
      credentials: new Map(),
      courseIssuers: new Map(),
      studentCredentials: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1INST";
  }

  setIssuerAuthority(authority: string): Result<boolean> {
    if (this.state.issuerAuthority !== null) return { ok: false, value: false };
    this.state.issuerAuthority = authority;
    return { ok: true, value: true };
  }

  setPassingGrade(newGrade: number): Result<boolean> {
    if (!this.state.issuerAuthority) return { ok: false, value: false };
    if (newGrade < 50 || newGrade > 100) return { ok: false, value: false };
    this.state.passingGrade = newGrade;
    return { ok: true, value: true };
  }

  registerCourseIssuer(
    courseId: number,
    maxCredentials: number
  ): Result<boolean> {
    if (!this.state.issuerAuthority) return { ok: false, value: false };
    if (maxCredentials <= 0) return { ok: false, value: false };
    this.state.courseIssuers.set(courseId, {
      institution: this.caller,
      active: true,
      maxCredentials,
      issuedCount: 0,
    });
    return { ok: true, value: true };
  }

  issueCredential(
    courseId: number,
    student: string,
    grade: number,
    assessmentHash: string
  ): Result<number> {
    const studentKey = `${student}-${courseId}`;
    if (this.state.studentCredentials.has(studentKey)) {
      return { ok: false, value: ERR_ALREADY_ISSUED };
    }

    const courseIssuer = this.state.courseIssuers.get(courseId);
    if (!courseIssuer || courseIssuer.institution !== this.caller) {
      return { ok: false, value: ERR_NOT_AUTHORIZED };
    }

    if (courseIssuer.issuedCount >= courseIssuer.maxCredentials) {
      return { ok: false, value: ERR_NOT_AUTHORIZED };
    }

    if (grade < this.state.passingGrade) {
      return { ok: false, value: ERR_GRADE_THRESHOLD };
    }

    if (assessmentHash.length !== 64) {
      return { ok: false, value: ERR_INVALID_HASH };
    }

    const credId = this.state.nextCredentialId;
    const credential: Credential = {
      recipient: student,
      courseId,
      issuer: this.caller,
      issueDate: this.blockHeight,
      grade,
      assessmentHash,
      status: true,
    };

    this.state.credentials.set(credId, credential);
    this.state.studentCredentials.set(studentKey, credId);
    this.state.courseIssuers.set(courseId, {
      ...courseIssuer,
      issuedCount: courseIssuer.issuedCount + 1,
    });
    this.state.nextCredentialId++;

    return { ok: true, value: credId };
  }

  revokeCredential(credId: number): Result<boolean> {
    const credential = this.state.credentials.get(credId);
    if (!credential || credential.issuer !== this.caller) {
      return { ok: false, value: false };
    }

    this.state.credentials.set(credId, { ...credential, status: false });
    return { ok: true, value: true };
  }

  getCredential(credId: number): Credential | null {
    return this.state.credentials.get(credId) || null;
  }

  getStudentCredential(student: string, courseId: number): number | null {
    return this.state.studentCredentials.get(`${student}-${courseId}`) || null;
  }

  isCredentialValid(credId: number): boolean {
    const cred = this.state.credentials.get(credId);
    return cred?.status || false;
  }

  getIssuedCount(courseId: number): number {
    const issuer = this.state.courseIssuers.get(courseId);
    return issuer?.issuedCount || 0;
  }

  getCredentialCount(): Result<number> {
    return { ok: true, value: this.state.nextCredentialId };
  }
}

describe("CredentialIssuance", () => {
  let contract: CredentialIssuanceMock;

  beforeEach(() => {
    contract = new CredentialIssuanceMock();
    contract.reset();
  });

  it("issues credential successfully", () => {
    contract.setIssuerAuthority("ST2AUTH");
    contract.registerCourseIssuer(101, 100);

    const result = contract.issueCredential(101, "ST1STUD", 85, "a".repeat(64));
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const cred = contract.getCredential(0);
    expect(cred?.recipient).toBe("ST1STUD");
    expect(cred?.grade).toBe(85);
    expect(cred?.status).toBe(true);
    expect(contract.getIssuedCount(101)).toBe(1);
  });

  it("rejects duplicate credential issuance", () => {
    contract.setIssuerAuthority("ST2AUTH");
    contract.registerCourseIssuer(101, 100);
    contract.issueCredential(101, "ST1STUD", 85, "a".repeat(64));

    const result = contract.issueCredential(101, "ST1STUD", 90, "b".repeat(64));
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_ALREADY_ISSUED);
  });

  it("rejects unauthorized issuer", () => {
    contract.setIssuerAuthority("ST2AUTH");
    contract.registerCourseIssuer(101, 100);
    contract.caller = "ST3FAKE";

    const result = contract.issueCredential(101, "ST1STUD", 85, "a".repeat(64));
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects failing grade", () => {
    contract.setIssuerAuthority("ST2AUTH");
    contract.registerCourseIssuer(101, 100);

    const result = contract.issueCredential(101, "ST1STUD", 60, "a".repeat(64));
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_GRADE_THRESHOLD);
  });

  it("rejects invalid hash length", () => {
    contract.setIssuerAuthority("ST2AUTH");
    contract.registerCourseIssuer(101, 100);

    const result = contract.issueCredential(101, "ST1STUD", 85, "short");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_HASH);
  });

  it("rejects max credentials exceeded", () => {
    contract.setIssuerAuthority("ST2AUTH");
    contract.registerCourseIssuer(101, 1);
    contract.issueCredential(101, "ST1STUD", 85, "a".repeat(64));

    const result = contract.issueCredential(101, "ST2STUD", 90, "b".repeat(64));
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("revokes credential successfully", () => {
    contract.setIssuerAuthority("ST2AUTH");
    contract.registerCourseIssuer(101, 100);
    contract.issueCredential(101, "ST1STUD", 85, "a".repeat(64));

    const revokeResult = contract.revokeCredential(0);
    expect(revokeResult.ok).toBe(true);

    expect(contract.isCredentialValid(0)).toBe(false);
  });

  it("rejects unauthorized revocation", () => {
    contract.setIssuerAuthority("ST2AUTH");
    contract.registerCourseIssuer(101, 100);
    contract.issueCredential(101, "ST1STUD", 85, "a".repeat(64));
    contract.caller = "ST3FAKE";

    const result = contract.revokeCredential(0);
    expect(result.ok).toBe(false);
  });



  it("validates credential status", () => {
    contract.setIssuerAuthority("ST2AUTH");
    contract.registerCourseIssuer(101, 100);
    contract.issueCredential(101, "ST1STUD", 85, "a".repeat(64));

    expect(contract.isCredentialValid(0)).toBe(true);
    contract.revokeCredential(0);
    expect(contract.isCredentialValid(0)).toBe(false);
  });

 

  it("parses Clarity types correctly", () => {
    const courseId = uintCV(101);
    const grade = uintCV(85);
    const hash = stringAsciiCV("a".repeat(64));

    expect(courseId.value).toEqual(BigInt(101));
    expect(grade.value).toEqual(BigInt(85));
    expect(hash.value).toBe("a".repeat(64));
  });

  it("sets passing grade successfully", () => {
    contract.setIssuerAuthority("ST2AUTH");
    const result = contract.setPassingGrade(80);
    expect(result.ok).toBe(true);
    expect(contract.state.passingGrade).toBe(80);
  });

  it("rejects invalid passing grade", () => {
    contract.setIssuerAuthority("ST2AUTH");
    const result = contract.setPassingGrade(40);
    expect(result.ok).toBe(false);
  });
});
