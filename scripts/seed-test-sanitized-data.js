import dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
} from 'firebase/firestore';

function loadEnv(path) {
  const result = dotenv.config({ path });
  if (result.error) {
    throw new Error(`Khong doc duoc file env: ${path}`);
  }
  return result.parsed || {};
}

function firebaseConfigFrom(env) {
  return {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };
}

function normalizeText(v) {
  return String(v || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function inferCategory(value) {
  const raw = normalizeText(value);
  if (!raw) return 'oc';
  if (raw === 'oc') return 'oc';
  if (raw === 'an_no') return 'an_no';
  if (raw === 'an_choi') return 'an_choi';
  if (raw === 'lai_rai') return 'lai_rai';
  if (raw === 'giai_khat') return 'giai_khat';
  return 'oc';
}

function pricingByCategory(category) {
  // Rule bao mat theo yeu cau:
  // - Mac dinh: von 20k, thue 10%, chi phi co dinh 10k
  // - Giai khat: ban 15k, von 10k, thue 8%, chi phi 1k
  // - Gia ban: oc 50k, an_no 100k, an_choi/lai_rai 30k
  if (category === 'giai_khat') {
    return {
      price: 15000,
      costPrice: 10000,
      tax: 8,
      fixedCost: 1000,
    };
  }

  const base = {
    costPrice: 20000,
    tax: 10,
    fixedCost: 10000,
  };

  if (category === 'an_no') {
    return { ...base, price: 100000 };
  }
  if (category === 'an_choi' || category === 'lai_rai') {
    return { ...base, price: 30000 };
  }
  return { ...base, price: 50000 }; // oc (mac dinh)
}

function menuKey(name, category) {
  return `${normalizeText(name)}__${category}`;
}

function orderKey(name, category, parentMenuItemId) {
  return `${normalizeText(name)}__${category}__${parentMenuItemId || 'none'}`;
}

async function readCollection(db, collectionName) {
  const snap = await getDocs(collection(db, collectionName));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function resetCollection(db, collectionName, dryRun) {
  const docs = await readCollection(db, collectionName);
  if (dryRun) {
    console.log(`[dry-run] Se xoa ${docs.length} doc trong ${collectionName}`);
    return;
  }
  for (const item of docs) {
    await deleteDoc(doc(db, collectionName, item.id));
  }
  console.log(`Da xoa ${docs.length} doc trong ${collectionName}`);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = !args.has('--apply');
  const resetTarget = args.has('--reset');

  const prodEnv = loadEnv('.env');
  const testEnv = loadEnv('.env.development.local');

  const prodProject = prodEnv.VITE_FIREBASE_PROJECT_ID;
  const testProject = testEnv.VITE_FIREBASE_PROJECT_ID;

  if (!prodProject || !testProject) {
    throw new Error('Thieu VITE_FIREBASE_PROJECT_ID trong env');
  }
  if (prodProject === testProject) {
    throw new Error('Project nguon va dich trung nhau. Dung lai de tranh ghi de.');
  }

  const prodApp = initializeApp(firebaseConfigFrom(prodEnv), 'prod-source');
  const testApp = initializeApp(firebaseConfigFrom(testEnv), 'test-target');
  const prodDb = getFirestore(prodApp);
  const testDb = getFirestore(testApp);

  console.log('=== SANITIZED SEED ===');
  console.log(`Source project: ${prodProject}`);
  console.log(`Target project: ${testProject}`);
  console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'APPLY'}`);
  console.log(`Reset target collections: ${resetTarget ? 'YES' : 'NO'}`);
  console.log('');

  const [sourceMenus, sourceOrders] = await Promise.all([
    readCollection(prodDb, 'menuItems'),
    readCollection(prodDb, 'orderItems'),
  ]);

  console.log(`Doc du lieu nguon: menuItems=${sourceMenus.length}, orderItems=${sourceOrders.length}`);

  const sanitizedMenus = sourceMenus.map((m) => {
    const category = inferCategory(m.category);
    const pricing = pricingByCategory(category);
    return {
      sourceId: m.id,
      key: menuKey(m.name, category),
      payload: {
        name: String(m.name || '').trim(),
        category,
        ...pricing,
      },
    };
  });

  if (resetTarget) {
    await resetCollection(testDb, 'orderItems', dryRun);
    await resetCollection(testDb, 'menuItems', dryRun);
  }

  const targetMenusBefore = await readCollection(testDb, 'menuItems');
  const targetMenuByKey = new Map();
  for (const m of targetMenusBefore) {
    const category = inferCategory(m.category);
    targetMenuByKey.set(menuKey(m.name, category), m);
  }

  const sourceMenuIdToTargetMenuId = new Map();
  let menuCreates = 0;
  let menuUpdates = 0;

  for (const item of sanitizedMenus) {
    const existing = targetMenuByKey.get(item.key);
    if (!existing) {
      menuCreates += 1;
      if (!dryRun) {
        const ref = await addDoc(collection(testDb, 'menuItems'), item.payload);
        sourceMenuIdToTargetMenuId.set(item.sourceId, ref.id);
        targetMenuByKey.set(item.key, { id: ref.id, ...item.payload });
      }
    } else {
      menuUpdates += 1;
      sourceMenuIdToTargetMenuId.set(item.sourceId, existing.id);
      if (!dryRun) {
        await updateDoc(doc(testDb, 'menuItems', existing.id), item.payload);
      }
    }
  }

  // Dry-run van can map de tinh toan order chinh xac
  if (dryRun) {
    for (const item of sanitizedMenus) {
      const existing = targetMenuByKey.get(item.key);
      if (existing) {
        sourceMenuIdToTargetMenuId.set(item.sourceId, existing.id);
      } else {
        sourceMenuIdToTargetMenuId.set(item.sourceId, `new:${item.key}`);
      }
    }
  }

  const targetOrdersBefore = await readCollection(testDb, 'orderItems');
  const targetOrderByKey = new Map();
  for (const o of targetOrdersBefore) {
    const category = inferCategory(o.category);
    targetOrderByKey.set(orderKey(o.name, category, o.parentMenuItemId || null), o);
  }

  let orderCreates = 0;
  let orderUpdates = 0;
  let orderMissingParent = 0;

  for (const src of sourceOrders) {
    const category = inferCategory(src.category);
    const parent = src.parentMenuItemId
      ? sourceMenuIdToTargetMenuId.get(src.parentMenuItemId) || null
      : null;

    // Truong hop order item co parent o source ma map sang target khong thay
    if (src.parentMenuItemId && !parent) {
      orderMissingParent += 1;
    }

    const pricing = pricingByCategory(category);
    const payload = {
      name: String(src.name || '').trim(),
      category,
      price: pricing.price,
      parentMenuItemId: parent,
      imageUrl: src.imageUrl || null,
      speed: src.speed || 'medium',
      priority: Number.isFinite(src.priority) ? src.priority : 1,
      kitchenType: src.kitchenType || 'cook',
      estimatedTime: Number.isFinite(src.estimatedTime) ? src.estimatedTime : 2,
    };

    const key = orderKey(payload.name, category, payload.parentMenuItemId);
    const existing = targetOrderByKey.get(key);

    if (!existing) {
      orderCreates += 1;
      if (!dryRun) {
        const ref = await addDoc(collection(testDb, 'orderItems'), payload);
        targetOrderByKey.set(key, { id: ref.id, ...payload });
      }
    } else {
      orderUpdates += 1;
      if (!dryRun) {
        await updateDoc(doc(testDb, 'orderItems', existing.id), payload);
      }
    }
  }

  console.log('');
  console.log('=== KET QUA ===');
  console.log(`menuItems: tao moi=${menuCreates}, cap nhat=${menuUpdates}`);
  console.log(`orderItems: tao moi=${orderCreates}, cap nhat=${orderUpdates}`);
  console.log(`orderItems missing parent map: ${orderMissingParent}`);

  if (dryRun) {
    console.log('');
    console.log('Day la DRY-RUN, chua ghi du lieu.');
    console.log('Neu ok, chay lai voi --apply');
    console.log('Co the them --reset de xoa du lieu cu o target truoc khi seed.');
    console.log('Vi du: node scripts/seed-test-sanitized-data.js --apply --reset');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Script loi:', err.message);
  process.exit(1);
});
