// sync.js - Hybrid local + Firestore sync system
// Each HTML page must load Firebase compat scripts BEFORE this file:
//   firebase-app-compat.js, firebase-auth-compat.js, firebase-firestore-compat.js
//   and initialize: firebase.initializeApp(FIREBASE_CONFIG);

const SyncManager = {
  isOnline: navigator.onLine,
  isElectron: typeof window.electronAPI !== 'undefined',

  LOCAL_IMAGES: {
    logo: 'logo.jpg',
    sello3: 'sello3.png',
    escudo: 'escudo_wiki.png',
    Escudo: 'Escudo.png',
    photo1: 'photo_5035272104688946255_w.jpg',
    photo2: 'photo_5037523904502631419_w.jpg',
    firmaLiliana: 'firma-liliana1.png',
    selloLiliana: 'sello-liliana.png',
    sello2: 'sello2.png',
    firmaLeo: 'firma-leo.png',
    selloLeo: 'sello-leo.png',
    fondoFirmas: 'fondo-firmas.png',
    imgAjedrez: 'img_ajedrez.png'
  },

  async getImage(imageName) {
    if (this.isElectron) {
      try {
        const result = await window.electronAPI.getLocalImage(this.LOCAL_IMAGES[imageName] || '');
        if (result.success) return 'file:///' + result.path;
      } catch (e) {}
    }
    return this.LOCAL_IMAGES[imageName] || '';
  },

  async getImageBase64(imageName) {
    if (this.isElectron) {
      try {
        const result = await window.electronAPI.getImageBase64(this.LOCAL_IMAGES[imageName] || imageName);
        if (result.success) return result.dataUrl;
      } catch (e) {}
    }
    return null;
  },

  async loadImageToElement(imgElement, imageName) {
    const src = await this.getImage(imageName);
    if (src) imgElement.src = src;
  },

  getDb() {
    if (typeof firebase !== 'undefined' && firebase.apps.length) {
      return firebase.firestore();
    }
    return null;
  },

  async fetchFromFirestore(collection, docId) {
    try {
      const db = this.getDb();
      if (!db) return null;
      const docSnap = await db.collection(collection).doc(docId).get();
      if (docSnap.exists) return docSnap.data();
    } catch (e) {
      console.error('Firestore fetch failed:', collection, docId, e);
    }
    return null;
  },

  async saveToFirestore(collection, docId, data) {
    try {
      const db = this.getDb();
      if (!db) return false;
      await db.collection(collection).doc(docId).set(data);
      return true;
    } catch (e) {
      console.error('Firestore save failed:', collection, docId, e);
      return false;
    }
  },

  async readData(fileName) {
    if (this.isElectron) {
      try {
        const result = await window.electronAPI.readDataFile(fileName);
        if (result.success) return result.content;
      } catch (e) {}
    }
    return null;
  },

  async writeData(fileName, data) {
    if (this.isElectron) {
      try {
        await window.electronAPI.writeDataFile(fileName, data);
        return true;
      } catch (e) {}
    }
    return false;
  },

  async getData(fileName, firestoreCollection, firestoreDoc) {
    const localData = await this.readData(fileName);
    if (localData) {
      if (navigator.onLine && firestoreCollection) {
        this.syncInBackground(fileName, firestoreCollection, firestoreDoc);
      }
      return localData;
    }
    if (navigator.onLine && firestoreCollection) {
      const firestoreData = await this.fetchFromFirestore(firestoreCollection, firestoreDoc);
      if (firestoreData) {
        const dataKey = Object.keys(firestoreData).find(k => Array.isArray(firestoreData[k]));
        const arrayData = dataKey ? firestoreData[dataKey] : firestoreData;
        await this.writeData(fileName, arrayData);
        return arrayData;
      }
    }
    return null;
  },

  async syncInBackground(fileName, firestoreCollection, firestoreDoc) {
    try {
      const firestoreData = await this.fetchFromFirestore(firestoreCollection, firestoreDoc);
      if (firestoreData) {
        const dataKey = Object.keys(firestoreData).find(k => Array.isArray(firestoreData[k]));
        const arrayData = dataKey ? firestoreData[dataKey] : firestoreData;
        await this.writeData(fileName, arrayData);
        window.dispatchEvent(new CustomEvent('data-synced', {
          detail: { fileName, data: arrayData }
        }));
      }
    } catch (e) {
      console.log('Background sync failed:', fileName);
    }
  },

  async checkInternet() {
    if (this.isElectron) return await window.electronAPI.checkInternet();
    return navigator.onLine;
  },

  init() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      document.dispatchEvent(new CustomEvent('connectivity-change', { detail: { online: true } }));
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
      document.dispatchEvent(new CustomEvent('connectivity-change', { detail: { online: false } }));
    });
  }
};

SyncManager.init();
