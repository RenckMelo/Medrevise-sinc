const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: config.projectId || config.authDomain.split('.')[0]
  });
}

const databaseId = config.firestoreDatabaseId || '(default)';
console.log(`Using Database ID: ${databaseId}`);
const db = getFirestore(admin.apps[0], databaseId);

async function main() {
  console.log("=== REMOTE REPAIR TOOL ===");
  console.log("Searching for user ysabelleosaraiva@gmail.com...");
  
  const usersRef = db.collection('users');
  const snap = await usersRef.where('email', '==', 'ysabelleosaraiva@gmail.com').get();
  
  if (snap.empty) {
    console.log("ERROR: User ysabelleosaraiva@gmail.com not found!");
    process.exit(1);
  }
  
  const userDoc = snap.docs[0];
  const userId = userDoc.id;
  const userData = userDoc.data();
  console.log(`SUCCESS: Found user! ID: ${userId}, Name: ${userData.name || userData.displayName || 'N/A'}`);
  
  console.log("Fetching active schedule...");
  const schedulesRef = db.collection('users').doc(userId).collection('schedules');
  const sSnap = await schedulesRef.get();
  
  if (sSnap.empty) {
    console.log("ERROR: No schedule found for Ysabelle!");
    process.exit(1);
  }
  
  console.log(`Found ${sSnap.docs.length} schedules.`);
  sSnap.docs.forEach(doc => {
    const d = doc.data();
    console.log(`- Schedule ID: ${doc.id}, Exam: ${d.exam}, startDate: ${d.startDate}, examDate: ${d.examDate}, weeks: ${d.weeks ? d.weeks.length : 0}`);
  });
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
