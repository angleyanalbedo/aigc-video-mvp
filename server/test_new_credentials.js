require('dotenv').config();
const { llmProvider, hasRealAPI } = require('./services/providers');

console.log('=== Testing New Volcengine Ark Credentials ===');
console.log('hasRealAPI detected:', hasRealAPI);
console.log('Using API KEY:', process.env.ARK_API_KEY ? process.env.ARK_API_KEY.substring(0, 15) + '...' : 'NONE');
console.log('Using LLM EP:', process.env.LLM_EP);

async function verify() {
  if (!hasRealAPI) {
    console.error('Error: providers did not detect the real API settings.');
    process.exit(1);
  }

  console.log('\nSending test prompt to Doubao LLM...');
  try {
    const text = await llmProvider.generateText({
      system: 'You are a helpful assistant.',
      prompt: '请写两句古诗描写江南风光。'
    });
    console.log('\n--- LLM Response ---');
    console.log(text);
    console.log('--------------------');
    console.log('\n✅ Verification SUCCESS! New credentials are 100% correct and working!');
  } catch (err) {
    console.error('\n❌ Verification FAILED:', err.message);
  }
}

verify().then(() => process.exit(0));
