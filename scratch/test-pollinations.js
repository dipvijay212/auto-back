async function run() {
  const testUrls = [
    'https://image.pollinations.ai/prompt/cat',
    'https://image.pollinations.ai/prompt/cat?width=1024&height=1280&nologo=true&private=true',
    'https://image.pollinations.ai/prompt/cat?width=512&height=512&nologo=true&private=true',
    'https://image.pollinations.ai/prompt/cat?width=512&height=640&nologo=true&private=true'
  ];

  for (const url of testUrls) {
    console.log(`\nFetching: ${url}`);
    try {
      const res = await fetch(url);
      console.log(`Response Status: ${res.status} (${res.statusText})`);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        console.log(`Success! Downloaded size: ${buf.byteLength} bytes`);
      } else {
        const text = await res.text();
        console.log(`Error Response Body:`, text);
      }
    } catch (err) {
      console.error("Fetch failed:", err);
    }
  }
}

run();
