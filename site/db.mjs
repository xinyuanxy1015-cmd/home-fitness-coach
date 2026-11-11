const connection = new Promise((resolve,reject)=>{
  const req=indexedDB.open('home-fitness-coach',1);
  req.onupgradeneeded=()=>req.result.createObjectStore('data');
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error);
});
export async function read() {
  const db=await connection;
  return new Promise((resolve,reject)=>{
    const req=db.transaction('data').objectStore('data').get('state');
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
export async function write(state) {
  const db=await connection;
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('data','readwrite');
    tx.objectStore('data').put(state,'state');
    tx.oncomplete=()=>resolve();
    tx.onabort=()=>reject(tx.error);
  });
}
