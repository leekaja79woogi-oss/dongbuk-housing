self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.map(k=>caches.delete(k)));
    await self.registration.unregister();
    const clientsList=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of clientsList){
      try{await client.navigate(client.url)}catch(e){}
    }
  })());
});
