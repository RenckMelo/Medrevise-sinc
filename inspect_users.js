import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function main() {
  console.log("Fetching users...");
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    console.log(`Found ${usersSnap.docs.length} users in 'users' collection.`);
    for (const doc of usersSnap.docs) {
      const data = doc.data();
      console.log(`User ID: ${doc.id}, Email: ${data.email || data.userEmail || 'N/A'}, Name: ${data.name || data.displayName || 'N/A'}`);
      
      // Get schedules for this user
      const schedSnap = await getDocs(collection(db, 'users', doc.id, 'schedules'));
      console.log(`  Schedules count: ${schedSnap.docs.length}`);
      schedSnap.docs.forEach(sDoc => {
        const sData = sDoc.data();
        console.log(`    Schedule ID: ${sDoc.id}, Title: ${sData.title || sData.name || 'Untitled'}, Active: ${sData.isActive}`);
      });
    }
  } catch (err) {
    console.error("Error fetching users:", err);
  }
  process.exit(0);
}

main();
