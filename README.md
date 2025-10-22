# 📜 Decentralized Credential Issuance for MOOCs

Welcome to a revolutionary platform for issuing and verifying educational credentials on the blockchain! This Web3 project addresses the real-world problem of credential fraud in Massive Open Online Courses (MOOCs). Traditional certificates can be easily forged, lost, or difficult to verify without contacting the issuing institution. By leveraging the Stacks blockchain and Clarity smart contracts, we enable immutable, tamper-proof credential issuance, instant global verification, and decentralized control—empowering learners, educators, and employers while reducing administrative overhead and promoting lifelong learning accessibility.

## ✨ Features

🔑 Decentralized issuance of verifiable credentials (e.g., certificates, badges) upon course completion  
📚 Immutable records of course enrollments, assessments, and achievements  
✅ Instant verification by anyone, anywhere, without intermediaries  
👥 Role-based access for students, instructors, institutions, and verifiers  
💰 Optional token-based incentives for course creators and completers  
🚀 Scalable governance for platform updates and dispute resolution  
🔒 Privacy-preserving design with zero-knowledge proofs for selective disclosure  
🌍 Global accessibility, reducing barriers in education credentialing  

## 🛠 How It Works

This project uses 8 interconnected Clarity smart contracts to create a robust ecosystem for MOOC credentialing. Each contract handles a specific aspect, ensuring modularity, security, and efficiency on the Stacks blockchain.

### Key Smart Contracts
1. **UserRegistry.clar**: Manages user registration and identity. Users (students, instructors, institutions) register with a unique principal and optional metadata (e.g., email hash for recovery). Prevents sybil attacks with basic KYC hooks.
   
2. **CourseManagement.clar**: Allows verified institutions or instructors to create and update courses. Stores course details like title, description, syllabus hash, and prerequisites. Emits events for new courses.

3. **Enrollment.clar**: Handles student enrollments. Students call an enroll function, paying any optional fees via STX or a utility token. Tracks enrollment status and prerequisites verification.

4. **Assessment.clar**: Manages quizzes, assignments, and exams. Instructors submit assessment criteria; students submit hashed responses. Uses oracles or off-chain computation for grading, storing final scores immutably.

5. **CredentialIssuance.clar**: Issues credentials upon successful completion. Triggers automatically based on assessment thresholds. Generates a unique credential ID with metadata (e.g., completion date, grade) and stores it on-chain.

6. **Verification.clar**: Provides public functions for credential verification. Anyone can query a credential ID to confirm issuer, recipient, and validity without revealing sensitive details (integrates zero-knowledge proofs).

7. **Governance.clar**: Enables DAO-style voting for platform upgrades, fee adjustments, or dispute resolutions. Uses a utility token for voting power, ensuring community-driven evolution.

8. **TokenUtility.clar**: Manages a custom fungible token (e.g., EDU-TOKEN) for incentives. Rewards instructors for course creation, students for completions, or verifiers for audits. Handles minting, burning, and transfers.

### For Institutions/Instructors
- Register via UserRegistry and create a course in CourseManagement.
- Set up assessments in Assessment.clar.
- Upon student completion, call CredentialIssuance to mint a credential—boom, it's eternally verifiable!

### For Students
- Enroll through Enrollment.clar (pay if required).
- Complete assessments and receive your immutable credential.
- Share your credential ID with employers for easy verification.

### For Verifiers (e.g., Employers)
- Use Verification.clar to check a credential ID.
- Optionally, query UserRegistry for recipient details or Governance for platform integrity.

