const fetch = require('node-fetch');

async function checkTimeData() {
  try {
    // This assumes the backend is running on localhost:3000
    const response = await fetch('http://localhost:3000/api/analytics/student/any-student-id', {
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      console.log('❌ Backend not responding. Make sure the platform server is running on localhost:3000');
      return;
    }

    console.log('✅ Backend is running and responding to analytics requests');
  } catch (error) {
    console.log('⚠️  Backend server check failed:');
    console.log('   Make sure you have the platform server running: npm run dev');
    console.log('   Currently checking localhost:3000');
  }
}

checkTimeData();
