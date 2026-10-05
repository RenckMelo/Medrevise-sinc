import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function main() {
  console.log("Querying users collection...");
  
  const usersRef = collection(db, 'users');
  const allUsersSnap = await getDocs(usersRef);
  console.log("Total users found:", allUsersSnap.size);

  allUsersSnap.forEach(d => {
    const data = d.data();
    console.log("USER:", d.id, "email:", data.email, "displayName:", data.displayName);
  });

  const q = query(usersRef, where('email', '==', 'ysabelleosaraiva@gmail.com'));
  const userSnap = await getDocs(q);

  if (userSnap.empty) {
    console.log("No exact match for ysabelleosaraiva@gmail.com");
  } else {
    for (const uDoc of userSnap.docs) {
      console.log("MATCHED USER:", uDoc.id);
      const schedRef = collection(db, 'users', uDoc.id, 'schedules');
      const schedSnap = await getDocs(schedRef);
      console.log("Total schedules:", schedSnap.size);
      schedSnap.forEach(sDoc => {
        const s = sDoc.data();
        console.log("--- SCHEDULE ---", sDoc.id);
        console.log("Exam:", s.exam);
        console.log("StartDate:", s.startDate, "ExamDate:", s.examDate);
        console.log("Weeks count:", s.weeks ? s.weeks.length : 0);
        console.log("Custom Topics count:", (s.collegeCustomTopics || s.collegeSelectedTopics || []).length);
        console.log("Custom Topics:", JSON.stringify(s.collegeCustomTopics || s.collegeSelectedTopics || []));
      });
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
