/* Ham & Ham — Cloud Edition. Public static frontend; ALL write permissions enforced by Supabase RLS. */
(() => {
  'use strict';
  const CFG = window.HAMHAM_CONFIG || {};
  const STARTER = (window.HAMHAM_STARTER_MENU || []).map(p => ({ ...p }));
  const DEFAULT_SITE = {
    brandName:'Ham & Ham', eyebrow:'🔥 المذاق اللي كيرجعك لينا',
    title:'الجوع عندو حلّ…',titleAccent:'طلبك عندنا!',
    description:'اختار المفضّل عندك من البرغر والبيتزا وباقي المأكولات، جمع طلبك فالسلة وصيفطو لينا مباشرة عبر واتساب.',
    buttonText:'شوف المنيو',footerText:'مرحبا بكم عندنا فاي وقت ❤️ • الطلب والتأكيد عبر واتساب',
    accent:'#ff8b24',red:'#f04432',bg:'#161312',logo:'',whatsapp:'212627004676'
  };
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = n => Number(n || 0).toLocaleString('fr-MA', {maximumFractionDigits:2})+' DH';
  const settingsIds = ['siteBrandName','siteWhatsapp','heroEyebrow','heroTitle','heroTitleAccent','heroDescription','heroButtonText','footerText','siteAccent','siteRed','siteBg'];
  const fields = ['name','category','price','description','image'];
  let sb=null, products=STARTER.map(p=>({...p})), settings={...DEFAULT_SITE}, cart={};
  let admin=false, ready=false, initialized=false, version=0, activeCategory='الكل',sortMode='default';
  let writing=false, settingsDirty=false, currentUpdatedAt='', checking=false;
  let logoObjectUrl=null;
  const validURL = url => /^https:\/\/[^\s"'<>]+$/i.test(url) || /^assets\/[\w./-]+$/i.test(url) || /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(url);
  const validPrice = value => value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 10000;
  function safeProduct(value) {
    if (!value || typeof value !== 'object' || !/^[a-zA-Z0-9_-]{1,90}$/.test(String(value.id||''))) return null;
    const num = Number(value.price);
    return {id:String(value.id),name:String(value.name||'وجبة').slice(0,110),category:String(value.category||'أخرى').slice(0,60),price:Number.isFinite(num)?Math.max(0,Math.min(10000,num)):0,description:String(value.description||'').slice(0,350),image:validURL(value.image||'')?value.image:''};
  }
  function cleanSettings(value={}) {
    const clean={...DEFAULT_SITE};
    for (const k of ['brandName','eyebrow','title','titleAccent','description','buttonText','footerText']) if (typeof value[k]==='string') clean[k]=value[k].slice(0,k==='description'?350:220);
    for (const k of ['accent','red','bg']) if (/^#[0-9a-f]{6}$/i.test(value[k]||'')) clean[k]=value[k];
    if (validURL(value.logo||'')) clean.logo=value.logo;
    const phone=String(value.whatsapp ?? DEFAULT_SITE.whatsapp).replace(/\D/g,'');
    clean.whatsapp=/^\d{10,15}$/.test(phone)?phone:DEFAULT_SITE.whatsapp;
    return clean;
  }
  function toast(message,error=false) {
    $('toast').textContent=message;$('toast').classList.toggle('error',error);$('toast').classList.add('show');
    clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('show'),4700);
  }
  function status(message,error=false,saving=false){$('saveStatus').textContent=message;$('saveStatus').classList.toggle('error',error);$('saveStatus').classList.toggle('saving',saving)}
  function banner(text,kind='missing'){$('connectionBanner').textContent=text;$('connectionBanner').className='cloud-banner '+kind;}
  function showError(error, fallback='تعذر حفظ التعديلات في قاعدة البيانات'){
    let detail=String(error?.message||'');
    if (/JWT|session|unauthorized|permission|42501|401|403/i.test(detail)) detail='صلاحية المدير غير متاحة. تحقق من تسجيل الدخول وقواعد الأمان.';
    else if (/Failed to fetch|NetworkError|fetch failed|Load failed/i.test(detail)) detail='اتصال الإنترنت أو Supabase غير متاح الآن.';
    else if (/size|413|Payload/i.test(detail)) detail='حجم الملف كبير، جرّب صورة أصغر.';
    const message=fallback+(detail?' — '+detail.slice(0,170):'');status('❌ '+message,true);toast('❌ '+message,true);
  }
  function applySettings(syncInputs=true){
    const s=settings;
    document.documentElement.style.setProperty('--accent',s.accent);
    document.documentElement.style.setProperty('--red',s.red);
    document.documentElement.style.setProperty('--dark',s.bg);
    document.querySelector('.hero-wrap').style.background=`linear-gradient(150deg,${s.bg},#151312 75%)`;
    const map={navBrandName:s.brandName,footerBrand:s.brandName,footerBrandSmall:s.brandName,heroEyebrowDisplay:s.eyebrow,heroTitleDisplay:s.title,heroAccentDisplay:s.titleAccent,heroDescriptionDisplay:s.description,heroButtonDisplay:s.buttonText,footerTextDisplay:s.footerText};
    for (const [id,value] of Object.entries(map)) $(id).textContent=value;
    const logo=s.logo||'assets/logo-c15dc3d2a661.png'; $('brandLogo').src=logo;$('heroLogo').src=logo;
    document.title=s.brandName+' | المنيو والطلب';
    if(syncInputs){const v={siteBrandName:s.brandName,siteWhatsapp:s.whatsapp,heroEyebrow:s.eyebrow,heroTitle:s.title,heroTitleAccent:s.titleAccent,heroDescription:s.description,heroButtonText:s.buttonText,footerText:s.footerText,siteAccent:s.accent,siteRed:s.red,siteBg:s.bg}; for(const [id,value] of Object.entries(v)) $(id).value=value;}
  }
  function inputSettings(){return cleanSettings({...settings,brandName:$('siteBrandName').value.trim()||DEFAULT_SITE.brandName,whatsapp:$('siteWhatsapp').value,eyebrow:$('heroEyebrow').value,title:$('heroTitle').value,titleAccent:$('heroTitleAccent').value,description:$('heroDescription').value,buttonText:$('heroButtonText').value,footerText:$('footerText').value,accent:$('siteAccent').value,red:$('siteRed').value,bg:$('siteBg').value})}
  function renderCategories(){
    const cats=['الكل',...new Set(products.map(p=>p.category||'أخرى'))];
    if(!cats.includes(activeCategory)) activeCategory='الكل';
    $('categoryNav').innerHTML=cats.map(cat=>{const count=cat==='الكل'?products.length:products.filter(p=>p.category===cat).length;return `<button class="category-chip ${cat===activeCategory?'active':''}" type="button" data-category="${esc(cat)}" aria-pressed="${cat===activeCategory}">${esc(cat)} <small>${count}</small></button>`}).join('');
    $('categoryOptions').innerHTML=cats.filter(x=>x!=='الكل').map(cat=>`<option value="${esc(cat)}"></option>`).join('');
  }
  function renderMenu(){
    renderCategories();const q=$('searchInput').value.trim().toLocaleLowerCase();
    const arr=products.filter(p=>(activeCategory==='الكل'||activeCategory===p.category)&&(!q||(p.name+' '+p.category+' '+p.description).toLocaleLowerCase().includes(q)));
    if(sortMode==='low')arr.sort((a,b)=>a.price-b.price);
    if(sortMode==='high')arr.sort((a,b)=>b.price-a.price);
    if(sortMode==='name')arr.sort((a,b)=>a.name.localeCompare(b.name,'ar'));
    $('productGrid').innerHTML=arr.length?arr.map(p=>`<article class="product-card"><div class="product-photo">${p.image?`<img loading="lazy" decoding="async" src="${esc(p.image)}" alt="${esc(p.name)}" onerror="this.hidden=true">`:''}<span class="category-label">${esc(p.category)}</span></div><div class="product-content"><h3 class="product-name">${esc(p.name)}</h3><p class="product-description">${esc(p.description||'محضّر بعناية من Ham & Ham.')}</p><div class="product-bottom"><span class="price">${money(p.price)}</span><button class="add-product" type="button" data-add="${esc(p.id)}" aria-label="إضافة ${esc(p.name)} للسلة">+</button></div></div><div class="admin-card-actions"><button type="button" data-edit="${esc(p.id)}">✏️ تعديل</button><button type="button" class="delete" data-delete="${esc(p.id)}">🗑 حذف</button></div></article>`).join(''):'<div class="no-results"><b>🔎 ما لقينا حتى منتج</b>جرّب كلمة أخرى أو اختار تصنيف مختلف.</div>';
    $('categoryNav').querySelectorAll('[data-category]').forEach(b=>b.addEventListener('click',()=>{activeCategory=b.dataset.category;renderMenu()}));
    $('productGrid').querySelectorAll('[data-add]').forEach(b=>b.addEventListener('click',()=>addCart(b.dataset.add)));
    $('productGrid').querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>openEditor(b.dataset.edit)));
    $('productGrid').querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>deleteProduct(b.dataset.delete)));
  }
  function addCart(id){const p=products.find(x=>x.id===id);if(!p)return;cart[id]=(cart[id]||0)+1;renderCart();toast('تزاد للسلة: '+p.name)}
  function renderCart(){
    for(const id in cart)if(!products.some(p=>p.id===id)||cart[id]<=0)delete cart[id];
    const num=Object.values(cart).reduce((a,b)=>a+b,0);$('cartCount').textContent=num;$('floatingCount').textContent=num;$('floatingCart').hidden=num===0;
    const rows=Object.entries(cart).map(([id,n])=>[products.find(p=>p.id===id),n]).filter(x=>x[0]);
    const total=rows.reduce((sum,[p,n])=>sum+p.price*n,0);$('cartTotal').textContent=money(total);
    $('cartItems').innerHTML=rows.length?rows.map(([p,n])=>`<div class="cart-row"><div><h3>${esc(p.name)}</h3><small>${money(p.price)} للوحدة</small><div class="quantity"><button type="button" data-qty="${esc(p.id)}" data-delta="-1" aria-label="إنقاص ${esc(p.name)}">−</button><b>${n}</b><button type="button" data-qty="${esc(p.id)}" data-delta="1" aria-label="زيادة ${esc(p.name)}">+</button><button type="button" class="remove" data-remove="${esc(p.id)}">حذف</button></div></div><span class="cart-price">${money(p.price*n)}</span></div>`).join(''):'<div class="cart-empty"><span>🛍️</span>السلة مازال خاوية<br>اختار شي أكلة وزيدها هنا.</div>';
    $('cartItems').querySelectorAll('[data-qty]').forEach(b=>b.addEventListener('click',()=>{cart[b.dataset.qty]=(cart[b.dataset.qty]||0)+Number(b.dataset.delta);renderCart()}));
    $('cartItems').querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>{delete cart[b.dataset.remove];renderCart()}));
  }
  function openModal(id){$(id).classList.add('open');document.body.classList.add('no-scroll')}
  function closeModal(id){$(id).classList.remove('open');if(!document.querySelector('.modal-backdrop.open,.drawer-backdrop.open'))document.body.classList.remove('no-scroll')}
  function adminMode(value){
    admin=value;document.body.classList.toggle('admin-on',admin);$('adminPanel').classList.toggle('open',admin);
    $('adminToggle').textContent=admin?'🔓':'⚙️';$('adminToggle').setAttribute('aria-label',admin?'فتح لوحة الإدارة':'دخول الإدارة');
    renderMenu();
    if(admin){status(initialized?'☁️ الاتصال جاهز. التعديلات لا تُحفظ إلا عند الضغط على حفظ.':'☁️ المنيو الأساسي جاهز. اضغط تهيئة المنيو لنشره في السحابة.');$('adminPanel').scrollIntoView({block:'start',behavior:'smooth'})}
    else{closeModal('editModal');settingsDirty=false;applySettings(true)}
  }
  function useRow(row, {preserveForm=false}={}){
    if(!row||typeof row.version!=='number')throw Error('Invalid database response');
    initialized=row.initialized===true;version=row.version;currentUpdatedAt=row.updated_at||'';
    products=(initialized?row.products:STARTER).map(safeProduct).filter(Boolean);
    settings=cleanSettings(initialized?row.settings:DEFAULT_SITE);
    applySettings(!preserveForm||!settingsDirty);renderMenu();renderCart();
    $('initializeCloud').hidden=initialized;
    $('checkout').disabled=false;
    ready=true;
    banner(initialized?'● الموقع متصل بالسحابة • أحدث الأسعار محفوظة':'● المنيو الأساسي جاهز • يجب تهيئته أول مرة من لوحة الإدارة','ready');
  }
  async function loadCloud({quiet=false,preserveForm=false}={}){
    if(!sb||checking||writing)return false;
    checking=true;
    try{
      const {data,error}=await sb.from('shop_state').select('initialized,products,settings,version,updated_at').eq('id',1).single();
      if(error)throw error;
      if(admin&&settingsDirty&&!preserveForm&&!quiet&&!confirm('عندك تغييرات في الإعدادات غير محفوظة. هل تريد تجاهلها وتحديث البيانات؟'))return false;
      useRow(data,{preserveForm});
      if(!quiet)toast('✅ تم تحميل أحدث نسخة من السحابة');
      return true;
    }catch(error){
      ready=false;$('checkout').disabled=true;
      banner('⚠️ تعذر تحميل أحدث المنيو من السحابة. الطلبات متوقفة حتى يرجع الاتصال.','error');
      if(!quiet)showError(error,'تعذر تحديث الموقع');
      return false;
    }finally{checking=false}
  }
  // This is optimistic concurrency control: if an edit from another device won the race,
  // the returned array is empty and we DO NOT announce save success or overwrite it.
  async function commit(nextProducts,nextSettings){
    if(!admin)throw Error('سجّل الدخول كمدير أولاً');
    if(!sb||!ready)throw Error('قاعدة البيانات غير متصلة؛ لم يتم الحفظ');
    if(writing)throw Error('هناك عملية حفظ جارية، حاول بعد اكتمالها');
    writing=true;status('⏳ جاري الحفظ والتحقق من استجابة قاعدة البيانات...',false,true);
    try{
      const savedProducts=nextProducts.map(safeProduct);
      if(savedProducts.some(x=>!x))throw Error('بيانات منتج غير صالحة');
      const {data,error}=await sb.from('shop_state')
        .update({products:savedProducts,settings:cleanSettings(nextSettings),initialized:true})
        .eq('id',1).eq('version',version)
        .select('initialized,products,settings,version,updated_at');
      if(error)throw error;
      if(!Array.isArray(data)||data.length!==1){
        status('⚠️ تعدّلت المعلومات من جهاز آخر؛ لم يتم حفظ هذا التعديل.',true);
        toast('تغيرت البيانات على جهاز آخر. حدّث المنيو ثم أعد المحاولة.',true);
        // Do not discard unsaved editor form. Caller may retry after a refresh.
        return false;
      }
      useRow(data[0]);settingsDirty=false;
      const time=new Date(data[0].updated_at||Date.now()).toLocaleTimeString('ar-MA',{hour:'2-digit',minute:'2-digit'});
      status('✅ تم التأكد من الحفظ في السحابة • '+time);
      toast('✅ تم حفظ التغييرات في قاعدة البيانات بنجاح');
      return true;
    }catch(error){showError(error);return false}
    finally{writing=false}
  }
  function allowChanges(){if(!admin){toast('سجّل الدخول كمدير',true);return false}return true}
  async function isRealAdmin(){const {data,error}=await sb.rpc('is_shop_admin');if(error)throw error;return data===true}
  async function logIn(event){
    event.preventDefault();if(!sb){toast('اربط Supabase أولاً',true);return}
    const username=$('loginUsername').value.trim();
    if(username.toLocaleLowerCase()!==String(CFG.ADMIN_USERNAME||'').trim().toLocaleLowerCase()){$('loginError').style.display='block';return}
    const pass=$('loginPassword').value,btn=$('loginSubmit');btn.disabled=true;btn.textContent='⏳ جارٍ التحقق...';
    try{
      const {error}=await sb.auth.signInWithPassword({email:CFG.ADMIN_EMAIL,password:pass});
      if(error)throw error;
      if(!await isRealAdmin()){await sb.auth.signOut();throw Error('هذا الحساب ليس مدير الموقع')}
      $('loginForm').reset();$('loginError').style.display='none';closeModal('loginModal');adminMode(true);
      toast('✅ تم تسجيل دخول المدير');
    }catch(error){$('loginError').textContent='تعذر الدخول: تحقق من اسم المستخدم وكلمة المرور وصلاحيات الحساب.';$('loginError').style.display='block';$('loginPassword').value='';toast('تعذر تسجيل الدخول',true)}
    finally{btn.disabled=false;btn.textContent='تسجيل الدخول'}
  }
  async function logOut(){
    if(settingsDirty&&!confirm('عندك إعدادات لم تحفظها. هل تريد تسجيل الخروج وتجاهلها؟'))return;
    try{const {error}=await sb.auth.signOut();if(error)throw error;adminMode(false);toast('✅ تم تسجيل الخروج بأمان')}
    catch(err){showError(err,'لم يتم تأكيد تسجيل الخروج')}
  }
  async function restoreAuth(){
    try{const {data,error}=await sb.auth.getUser();if(error&&data?.user)throw error;
      if(data?.user&&await isRealAdmin()){adminMode(true)}
      else if(data?.user)await sb.auth.signOut();
    }catch(_){adminMode(false)}
  }
  function openEditor(id){if(!allowChanges())return;const p=products.find(p=>p.id===id);if(!p)return;
    $('editId').value=id;$('editName').value=p.name;$('editPrice').value=p.price;$('editCategory').value=p.category;
    $('editDescription').value=p.description;$('editImage').value='';$('editImagePreview').src=p.image||'assets/logo-c15dc3d2a661.png';openModal('editModal');
  }
  function takeForm(formPrefix){
    const edit=formPrefix==='edit'; const name=$(edit?'editName':'newName').value.trim(),price=$(edit?'editPrice':'newPrice').value,cat=$(edit?'editCategory':'newCategory').value.trim()||'أخرى';
    if(!name||!validPrice(price)||!cat){toast('اسم الوجبة والثمن والتصنيف مطلوبون',true);return null}
    return {name,price:Number(price),category:cat,description:$(edit?'editDescription':'newDescription').value.trim()};
  }
  async function optimizeImage(file){
    if(!file||!/^image\/(png|jpeg|webp|gif)$/i.test(file.type))throw Error('يرجى اختيار صورة PNG أو JPG أو WEBP');
    if(file.size>15*1024*1024)throw Error('الصورة كبيرة جدًا، الحد 15 ميغابايت قبل الضغط');
    const object=URL.createObjectURL(file);
    try{
      const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('تعذر فتح الصورة'));image.src=object});
      const scale=Math.min(1,1100/Math.max(image.naturalWidth,image.naturalHeight));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
      canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.77));
      if(!blob)throw Error('تعذر تحويل الصورة إلى صيغة مناسبة');
      return blob;
    }finally{URL.revokeObjectURL(object)}
  }
  async function uploadImage(file,folder){
    if(!admin)throw Error('غير مسموح برفع الصور دون الدخول');
    const blob=await optimizeImage(file);const path=`${folder}/${crypto.randomUUID()}.webp`;
    const {error}=await sb.storage.from('menu-images').upload(path,blob,{contentType:'image/webp',upsert:false});
    if(error)throw error;
    const {data}=sb.storage.from('menu-images').getPublicUrl(path);
    if(!data?.publicUrl)throw Error('لم نستطع الحصول على رابط الصورة');
    return data.publicUrl;
  }
  async function saveEdit(event){event.preventDefault();if(!allowChanges())return;
    const props=takeForm('edit');if(!props)return;
    const id=$('editId').value,p=products.find(p=>p.id===id);if(!p){toast('هذا المنتج لم يعد موجودًا',true);return}
    const btn=$('saveEdit');btn.disabled=true;
    try{const file=$('editImage').files[0];const image=file?await uploadImage(file,'products'):p.image;
      const next=products.map(row=>row.id===id?{...row,...props,image}:row);
      if(await commit(next,settings))closeModal('editModal');
    }catch(error){showError(error,'فشل رفع الصورة أو حفظ المنتج')}
    finally{btn.disabled=false}
  }
  async function saveNew(event){event.preventDefault();if(!allowChanges())return;
    const props=takeForm('new');if(!props)return;
    const btn=$('addProductButton');btn.disabled=true;
    try{const file=$('newImage').files[0];const image=file?await uploadImage(file,'products'):'';
      const id='u_'+crypto.randomUUID().replace(/-/g,'').slice(0,18);
      if(await commit([...products,{id,...props,image}],settings))$('addProductForm').reset();
    }catch(error){showError(error,'فشل إضافة المنتج')}
    finally{btn.disabled=false}
  }
  async function deleteProduct(id){if(!allowChanges())return;
    const p=products.find(p=>p.id===id);if(!p||!confirm('هل تريد حذف «'+p.name+'» نهائيًا من الموقع؟'))return;
    if(await commit(products.filter(p=>p.id!==id),settings)){delete cart[id];renderCart()}
  }
  async function saveSettings(){if(!allowChanges())return;
    const button=$('saveSiteSettings');button.disabled=true;
    try{
      let next=inputSettings();const file=$('siteLogoFile').files[0];
      if(file)next={...next,logo:await uploadImage(file,'logos')};
      if(await commit(products,next)){$('siteLogoFile').value='';settingsDirty=false}
    }catch(error){showError(error,'لم يتم حفظ إعدادات الموقع')}
    finally{button.disabled=false}
  }
  async function resetSettings(){if(!allowChanges()||!confirm('هل تريد استرجاع تصميم البداية وحفظه في السحابة؟'))return;
    if(await commit(products,{...DEFAULT_SITE})){$('siteLogoFile').value='';settingsDirty=false}
  }
  async function resetMenu(){if(!allowChanges()||!confirm('سيُستبدل المنيو المنشور بالـ53 منتجًا الأصليين. هل أنت متأكد؟'))return;
    if(await commit(STARTER.map(p=>({...p})),settings)){activeCategory='الكل';cart={};renderCart()}
  }
  async function initializeCloud(){if(!allowChanges())return;if(initialized){toast('المنيو مُهيّأ بالفعل');return}
    if(!confirm('سيتم نشر جميع المنتجات الأصلية على قاعدة البيانات. متابعة؟'))return;
    await commit(products,settings);
  }
  function download(filename,text,type='application/json;charset=utf-8'){
    const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
  function exportBackup(){if(!allowChanges())return;
    const payload={format:'hamham-cloud-v1',exportedAt:new Date().toISOString(),version,products,settings};
    download('hamham-cloud-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(payload,null,2));
    toast('✅ تم تنزيل نسخة احتياطية من البيانات الحالية');
  }
  function legacyInflate(source){
    if(!source||source.version!==3||!source.updated||!Array.isArray(source.added)||!Array.isArray(source.removed))throw Error('نسخة قديمة غير صالحة');
    const removed=new Set(source.removed);const rows=STARTER.filter(p=>!removed.has(p.id)).map(p=>({ ...p,...(source.updated[p.id]||{}) }));
    const known=new Set(rows.map(p=>p.id));for(const p of source.added){if(p.id&&!known.has(p.id)){rows.push(p);known.add(p.id)}}
    return {products:rows,settings:cleanSettings(source.site||{})};
  }
  function decodeDataUri(data){const [header,raw]=data.split(',',2),mime=header.match(/^data:([^;]+);base64$/i)?.[1];if(!mime||!raw)throw Error('Invalid image');const binary=atob(raw),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return new File([bytes],'import.jpg',{type:mime})}
  async function importBackup(file){if(!allowChanges()||!file)return;
    if(file.size>18*1024*1024){toast('حجم ملف النسخة الاحتياطية كبير جدًا',true);return}
    if(!confirm('استيراد نسخة احتياطية سيستبدل المنيو والإعدادات الحالية في السحابة. متابعة؟'))return;
    const input=$('importData');input.disabled=true;
    try{
      const raw=JSON.parse(await file.text());let snapshot;
      if(raw?.format==='hamham-cloud-v1'&&Array.isArray(raw.products))snapshot={products:raw.products,settings:raw.settings};
      else if(raw?.version===3)snapshot=legacyInflate(raw);
      else if(Array.isArray(raw))snapshot={products:raw,settings};
      else throw Error('نوع النسخة الاحتياطية غير مدعوم');
      const normalized=snapshot.products.map(safeProduct);if(normalized.some(x=>!x))throw Error('النسخة تحتوي منتجات غير صالحة');
      const cached=new Map();
      for(const p of normalized){
        if(p.image.startsWith('data:image/')){
          if(!cached.has(p.image))cached.set(p.image,await uploadImage(decodeDataUri(p.image),'products'));
          p.image=cached.get(p.image);
        }
      }
      let site=cleanSettings(snapshot.settings||{});
      if(site.logo.startsWith('data:image/'))site.logo=await uploadImage(decodeDataUri(site.logo),'logos');
      if(await commit(normalized,site))toast('✅ تمت استعادة النسخة وحفظها في السحابة');
    }catch(error){showError(error,'فشلت عملية الاستيراد')}
    finally{input.disabled=false;input.value=''}
  }
  function checkout(){
    if(!ready){toast('تعذر تأكيد الأسعار لأن الاتصال بالسحابة غير متاح',true);return}
    const entries=Object.entries(cart).map(([id,n])=>[products.find(p=>p.id===id),n]).filter(x=>x[0]);
    if(!entries.length){toast('السلة خاوية. أضف بعض الوجبات أولاً',true);return}
    const total=entries.reduce((v,[p,n])=>v+p.price*n,0);
    const lines=['السلام عليكم '+settings.brandName+' 👋','بغيت نطلب:','',...entries.map(([p,n])=>`• ${p.name} × ${n} = ${money(p.price*n)}`),'',`المجموع: ${money(total)}`];
    for(const [id,label] of [['customerName','الاسم'],['customerAddress','عنوان التوصيل'],['customerNote','ملاحظات']]){const val=$(id).value.trim();if(val)lines.push(label+': '+val)}
    lines.push('شكراً لكم ❤️');
    const url='https://wa.me/'+settings.whatsapp+'?text='+encodeURIComponent(lines.join('\n'));
    const win=window.open(url,'_blank','noopener,noreferrer');if(!win)window.location.assign(url);
  }
  function attachEvents(){
    $('searchInput').addEventListener('input',renderMenu);
    $('sortSelect').addEventListener('change',e=>{sortMode=e.target.value;renderMenu()});
    $('openCart').onclick=$('floatingCart').onclick=()=>{renderCart();openModal('cartOverlay')};
    $('closeCart').onclick=()=>closeModal('cartOverlay');$('checkout').onclick=checkout;
    $('adminToggle').onclick=()=>{if(admin){$('adminPanel').scrollIntoView({behavior:'smooth',block:'start'})}else if(!sb){toast('يجب إعداد Supabase في config.js أولاً',true)}else{openModal('loginModal');$('loginUsername').focus()}};
    $('loginForm').addEventListener('submit',logIn);
    $('adminLogout').onclick=logOut;
    $('closeLogin').onclick=()=>closeModal('loginModal');
    $('closeEdit').onclick=$('cancelEdit').onclick=()=>closeModal('editModal');
    for(const id of ['cartOverlay','loginModal','editModal'])$(id).addEventListener('click',e=>{if(e.target===$(id))closeModal(id)});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){for(const id of ['cartOverlay','loginModal','editModal'])closeModal(id)}});
    $('editForm').addEventListener('submit',saveEdit);$('addProductForm').addEventListener('submit',saveNew);
    $('saveSiteSettings').onclick=saveSettings;$('resetSiteSettings').onclick=resetSettings;
    $('initializeCloud').onclick=initializeCloud;$('resetData').onclick=resetMenu;
    $('exportData').onclick=exportBackup;$('importData').onchange=e=>importBackup(e.target.files[0]);
    $('refreshCloud').onclick=()=>loadCloud();
    for(const id of settingsIds)$(id).addEventListener('input',()=>{if(admin){settingsDirty=true;status('✎ لديك إعدادات غير محفوظة. اضغط حفظ الإعدادات.',false)}});
    $('siteLogoFile').addEventListener('change',()=>{if(admin){settingsDirty=true;status('✎ صورة الشعار جاهزة. اضغط حفظ الإعدادات.') }});
    window.addEventListener('beforeunload',e=>{if(admin&&settingsDirty){e.preventDefault();e.returnValue=''}});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&ready&&!writing&&!settingsDirty)loadCloud({quiet:true,preserveForm:true})});
    window.setInterval(()=>{if(document.visibilityState==='visible'&&ready&&!writing&&!settingsDirty)loadCloud({quiet:true,preserveForm:true})},60000);
  }
  async function init(){
    $('year').textContent=new Date().getFullYear();applySettings(true);renderMenu();renderCart();attachEvents();
    const url=String(CFG.SUPABASE_URL||'').trim(),key=String(CFG.SUPABASE_ANON_KEY||'').trim();
    if(!/^https:\/\/[^/]+\.supabase\.co\/?$/.test(url)||!key||!String(CFG.ADMIN_EMAIL||'').includes('@')||!String(CFG.ADMIN_USERNAME||'').trim()){
      banner('⚙️ وضع المعاينة: المنتجات ظاهرة، لكن الحفظ والطلبات متوقفان حتى تملأ config.js وتنفذ SQL في Supabase.','missing');
      status('لم يتم تهيئة Supabase بعد. اتبع README_AR.md.',true);return;
    }
    if(!window.supabase?.createClient){banner('⚠️ تعذر تحميل مكتبة Supabase. تحقق من اتصال الإنترنت.','error');status('لم تتوفر مكتبة Supabase',true);return}
    try{
      sb=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
      const ok=await loadCloud({quiet:true});if(ok){await restoreAuth();if(!admin)status('🔒 عرض الزبائن؛ التعديل متاح للمدير فقط.');}
    }catch(err){showError(err,'تعذر الاتصال بقاعدة البيانات');banner('❌ فشل الاتصال بقاعدة البيانات','error')}
    // Sign-out on another tab is reflected without ever granting admin privileges client-side.
    sb?.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'&&admin)adminMode(false)});
  }
  init();
})();
