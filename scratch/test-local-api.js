// Use global fetch

async function run() {
  console.log("Sending request to generate images...");
  try {
    const res = await fetch('http://127.0.0.1:5000/api/images/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentPlanId: '6a33986117dcefe36bde6432' })
    });
    
    console.log("Response Status:", res.status);
    const text = await res.text();
    console.log("Response Text:", text);
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

run();
