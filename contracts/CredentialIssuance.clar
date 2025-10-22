(define-constant ERR-NOT_AUTHORIZED (err u1000))
(define-constant ERR_INVALID_GRADE (err u1001))
(define-constant ERR_ALREADY_ISSUED (err u1002))
(define-constant ERR_NO_ENROLLMENT (err u1003))
(define-constant ERR_ASSESSMENT_FAILED (err u1004))
(define-constant ERR_INVALID_COURSE (err u1005))
(define-constant ERR_CREDENTIAL_REVOKED (err u1006))
(define-constant ERR_INVALID_HASH (err u1007))
(define-constant ERR_COURSE_NOT_ACTIVE (err u1008))
(define-constant ERR_GRADE_THRESHOLD (err u1009))

(define-data-var passing-grade uint u70)
(define-data-var next-credential-id uint u0)
(define-data-var issuer-authority (optional principal) none)

(define-map credentials
  { credential-id: uint }
  {
    recipient: principal,
    course-id: uint,
    issuer: principal,
    issue-date: uint,
    grade: uint,
    assessment-hash: (string-ascii 64),
    status: bool
  })

(define-map course-issuers
  uint
  { 
    institution: principal,
    active: bool,
    max-credentials: uint,
    issued-count: uint
  })

(define-map student-credentials
  { student: principal, course-id: uint }
  uint)

(define-read-only (get-credential (cred-id uint))
  (map-get? credentials { credential-id: cred-id }))

(define-read-only (get-student-credential (student principal) (course-id uint))
  (map-get? student-credentials { student: student, course-id: course-id }))

(define-read-only (is-credential-valid (cred-id uint))
  (match (map-get? credentials { credential-id: cred-id })
    cred (get status cred)
    false))

(define-read-only (get-issued-count (course-id uint))
  (match (map-get? course-issuers course-id)
    issuer (get issued-count issuer)
    u0))

(define-private (validate-grade (grade uint))
  (if (>= grade (var-get passing-grade))
      (ok true)
      (err ERR_GRADE_THRESHOLD)))

(define-private (validate-hash (hash (string-ascii 64)))
  (if (is-eq (len hash) u64)
      (ok true)
      (err ERR_INVALID_HASH)))

(define-private (validate-issuer (course-id uint))
  (match (map-get? course-issuers course-id)
    issuer 
      (if (is-eq (get institution issuer) tx-sender)
          (ok true)
          (err ERR_NOT_AUTHORIZED))
    (err ERR_INVALID_COURSE)))

(define-private (can-issue-more (course-id uint))
  (match (map-get? course-issuers course-id)
    issuer 
      (let ((issued (get issued-count issuer))
            (max-allowed (get max-credentials issuer)))
        (if (<= issued max-allowed)
            (ok true)
            (err ERR_NOT_AUTHORIZED)))
    (err ERR_INVALID_COURSE)))

(define-public (set-issuer-authority (authority principal))
  (begin
    (asserts! (is-none (var-get issuer-authority)) (err ERR_NOT_AUTHORIZED))
    (var-set issuer-authority (some authority))
    (ok true)))

(define-public (set-passing-grade (new-grade uint))
  (begin
    (asserts! (is-some (var-get issuer-authority)) (err ERR_NOT_AUTHORIZED))
    (asserts! (and (>= new-grade u50) (<= new-grade u100)) (err ERR_INVALID_GRADE))
    (var-set passing-grade new-grade)
    (ok true)))

(define-public (register-course-issuer 
  (course-id uint) 
  (max-credentials uint))
  (begin
    (asserts! (is-some (var-get issuer-authority)) (err ERR_NOT_AUTHORIZED))
    (asserts! (> max-credentials u0) (err ERR_INVALID_COURSE))
    (map-set course-issuers course-id
      {
        institution: tx-sender,
        active: true,
        max-credentials: max-credentials,
        issued-count: u0
      })
    (ok true)))

(define-public (issue-credential 
  (course-id uint)
  (student principal)
  (grade uint)
  (assessment-hash (string-ascii 64)))
  (let (
        (cred-id (var-get next-credential-id))
        (existing (map-get? student-credentials { student: student, course-id: course-id }))
      )
    (asserts! (is-none existing) (err ERR_ALREADY_ISSUED))
    (try! (validate-issuer course-id))
    (try! (can-issue-more course-id))
    (try! (validate-grade grade))
    (try! (validate-hash assessment-hash))
    
    (map-set credentials 
      { credential-id: cred-id }
      {
        recipient: student,
        course-id: course-id,
        issuer: tx-sender,
        issue-date: block-height,
        grade: grade,
        assessment-hash: assessment-hash,
        status: true
      })
    
    (map-set student-credentials 
      { student: student, course-id: course-id }
      cred-id)
    
    (map-set course-issuers course-id
      (let ((current (unwrap! (map-get? course-issuers course-id) (err ERR_INVALID_COURSE)))
            (new-count (+ (get issued-count current) u1)))
        {
          institution: (get institution current),
          active: (get active current),
          max-credentials: (get max-credentials current),
          issued-count: new-count
        }))
    
    (var-set next-credential-id (+ cred-id u1))
    (print { event: "credential-issued", id: cred-id })
    (ok cred-id)))

(define-public (revoke-credential (cred-id uint))
  (let ((cred (map-get? credentials { credential-id: cred-id })))
    (match cred
      c 
        (begin
          (asserts! (is-eq (get issuer c) tx-sender) (err ERR_NOT_AUTHORIZED))
          (map-set credentials 
            { credential-id: cred-id }
            {
              recipient: (get recipient c),
              course-id: (get course-id c),
              issuer: (get issuer c),
              issue-date: (get issue-date c),
              grade: (get grade c),
              assessment-hash: (get assessment-hash c),
              status: false
            })
          (print { event: "credential-revoked", id: cred-id })
          (ok true))
      (err ERR_NOT_AUTHORIZED))))

(define-public (get-credential-count)
  (ok (var-get next-credential-id)))