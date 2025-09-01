// Test script for stream resumption
const testStreamResumption = async () => {
  const apiUrl = 'http://localhost:3001/api/chat';
  
  console.log('Testing stream resumption...\n');
  
  // Test 1: Start a stream
  console.log('1. Starting initial stream...');
  const response1 = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'user', content: 'Tell me a story about a cat. Make it at least 200 words long.' }
      ],
      model: 'openai/gpt-4o-mini',
      streamId: 'test-stream-123'
    })
  });
  
  const reader1 = response1.body.getReader();
  const decoder = new TextDecoder();
  let content = '';
  let streamId = response1.headers.get('X-Stream-Id');
  console.log('Stream ID:', streamId);
  
  // Read first 5 chunks then stop
  let chunks = 0;
  while (chunks < 5) {
    const { done, value } = await reader1.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'delta') {
              content += parsed.content;
              process.stdout.write(parsed.content);
              chunks++;
            }
          } catch (e) {
            // Plain text
            content += data;
            process.stdout.write(data);
            chunks++;
          }
        }
      }
    }
  }
  
  console.log('\n\n2. Stream stopped after', chunks, 'chunks');
  console.log('Partial content length:', content.length);
  reader1.cancel();
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 2: Resume the stream
  console.log('\n3. Resuming stream...\n');
  const response2 = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'user', content: 'Tell me a story about a cat. Make it at least 200 words long.' }
      ],
      model: 'openai/gpt-4o-mini',
      streamId: streamId || 'test-stream-123',
      resume: true
    })
  });
  
  const reader2 = response2.body.getReader();
  let resumedContent = '';
  let foundResume = false;
  
  while (true) {
    const { done, value } = await reader2.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'resume') {
              console.log('Found resume data, length:', parsed.content.length);
              foundResume = true;
            } else if (parsed.type === 'delta') {
              resumedContent += parsed.content;
              process.stdout.write(parsed.content);
            } else if (parsed.type === 'done') {
              console.log('\n\nStream completed!');
            }
          } catch (e) {
            // Handle plain text
          }
        }
      }
    }
  }
  
  console.log('\n\n4. Test complete!');
  console.log('- Original content:', content.length, 'chars');
  console.log('- Resumed content:', resumedContent.length, 'chars');
  console.log('- Found resume marker:', foundResume);
  
  // Test 3: Check stream state
  console.log('\n5. Checking stream state...');
  const stateResponse = await fetch(`${apiUrl}?streamId=${streamId || 'test-stream-123'}`);
  if (stateResponse.ok) {
    const state = await stateResponse.json();
    console.log('Stream state:', {
      hasMessages: state.messages?.length > 0,
      hasPartialResponse: state.partialResponse?.length > 0,
      model: state.model
    });
  } else {
    console.log('Stream state not found');
  }
};

testStreamResumption().catch(console.error);