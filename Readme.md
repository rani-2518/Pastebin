# Pastebin-Lite
 Pastebin-like application built using Node.js, Express and Redis. 
 
 ## Run Locally 
 1. Start Redis (local or cloud like Upstash)
 
  Using LINK : https://upstash.com/
  
 2. Set REDIS_URL environment variable 
 3. Install & run:
  npm install 
  npm start 
  
  Server runs on http://localhost:3000
  
   ## Persistence Layer 
   
   Uses Redis (Upstash recommended) to store pastes.
   
    ## Notes -
    
     Supports deterministic expiry testing using 
     TEST_MODE=1
      - Uses x-test-now-ms header for controlled time
      - Meets all assignment requirements