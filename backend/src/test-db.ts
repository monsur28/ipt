import http from 'http';

async function main() {
  const url = 'http://localhost:8080/api/stream/04bddd0e-b8e1-4ace-a24c-56b6dba1d35b';
  console.log('Sending stream request for Gol Classics:', url);

  http.get(url, (res) => {
    console.log('Response status code:', res.statusCode);
    console.log('Response headers:', res.headers);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Response body:', data);
    });
  }).on('error', (err) => {
    console.error('Request error:', err);
  });
}

main().catch(console.error);
