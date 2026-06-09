import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, getDoc, addDoc, deleteDoc, updateDoc, query, orderBy } from 'firebase/firestore';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { db, auth, googleProvider } from './firebase';
import { AnimatePresence, motion } from 'framer-motion';
import { ShoppingBasket, Trash2, Plus, Check, LogOut, Share2, Users, ChevronRight, FolderPlus, List, Copy } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // ניהול רשימות
  const [myLists, setMyLists] = useState([]);
  const [currentListId, setCurrentListId] = useState(localStorage.getItem('current_list_id') || null);
  const [currentListName, setCurrentListName] = useState(localStorage.getItem('current_list_name') || '');
  const [newListName, setNewListName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // ניהול פריטים
  const [items, setItems] = useState([]);
  const [itemName, setItemName] = useState('');
  const [itemQuantity, setItemQuantity] = useState('');

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'myLists'), orderBy('joinedAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setMyLists(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [user]);

  useEffect(() => {
    if (!user || !currentListId) return;
    const q = query(collection(db, 'lists', currentListId, 'items'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, [user, currentListId]);

  const handleLogin = async () => await signInWithPopup(auth, googleProvider);
  const handleLogout = () => { signOut(auth); localStorage.clear(); setCurrentListId(null); setCurrentListName(''); };

  const handleCreateList = async (e) => {
    e.preventDefault();
    if (newListName.trim() === '') return;
    setIsCreating(true);
    try {
      const userFirstName = user.displayName?.split(' ')[0].toUpperCase() || 'LIST';
      const uniqueCode = `${userFirstName}-${Math.floor(100 + Math.random() * 900)}`;
      await setDoc(doc(db, 'lists', uniqueCode), { name: newListName, createdBy: user.uid, createdAt: new Date() });
      await setDoc(doc(db, 'users', user.uid, 'myLists', uniqueCode), { name: newListName, joinedAt: new Date() });
      selectList(uniqueCode, newListName);
      setNewListName('');
    } catch (error) { console.error(error); } finally { setIsCreating(false); }
  };

  const handleJoinList = async (e) => {
    e.preventDefault();
    if (joinCode.trim() === '') return;
    const cleanCode = joinCode.trim().toUpperCase();
    try {
      const listDoc = await getDoc(doc(db, 'lists', cleanCode));
      if (listDoc.exists()) {
        const listData = listDoc.data();
        await setDoc(doc(db, 'users', user.uid, 'myLists', cleanCode), { name: listData.name, joinedAt: new Date() });
        selectList(cleanCode, listData.name);
        setJoinCode('');
      } else { alert('קוד הרשימה לא נמצא.'); }
    } catch (error) { console.error(error); }
  };

  const selectList = (id, name) => {
    setCurrentListId(id); setCurrentListName(name);
    localStorage.setItem('current_list_id', id); localStorage.setItem('current_list_name', name);
  };

  const handleLeaveListView = () => {
    setCurrentListId(null); setCurrentListName('');
    localStorage.removeItem('current_list_id'); localStorage.removeItem('current_list_name');
  };

  const copyShareInvite = () => {
    navigator.clipboard.writeText(`היי! קוד ההצטרפות לרשימה *${currentListName}* הוא:\n${currentListId}`);
    alert('קוד ההזמנה הועתק, אפשר לשלוח בוואטסאפ!');
  };

  const copyJustCode = () => {
    navigator.clipboard.writeText(currentListId);
    alert('הקוד הועתק!');
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (itemName.trim() === '' || !currentListId) return;
    await addDoc(collection(db, 'lists', currentListId, 'items'), {
      name: itemName, quantity: itemQuantity, completed: false, added_by_name: user?.displayName?.split(' ')[0] || 'שותף', createdAt: new Date()
    });
    setItemName(''); setItemQuantity('');
  };

  const handleToggleItem = async (item) => await updateDoc(doc(db, 'lists', currentListId, 'items', item.id), { completed: !item.completed });
  const handleDeleteItem = async (item) => await deleteDoc(doc(db, 'lists', currentListId, 'items', item.id));

  const sortedItems = [...items].sort((a, b) => a.completed === b.completed ? 0 : a.completed ? 1 : -1);
  const remainingCount = items.filter(item => !item.completed).length;

  if (authLoading) return <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center"><div className="w-8 h-8 border-4 border-gray-300 border-t-gray-800 rounded-full animate-spin" /></div>;

  // מסך כניסה
  if (!user) return (
    <div dir="rtl" className="min-h-screen bg-[#F2F2F7] flex items-center justify-center p-6" style={{ fontFamily: "'Rubik', sans-serif" }}>
      <div className="bg-white p-8 rounded-[32px] shadow-sm w-full max-w-sm text-center">
        {/* האייקון הראשי חזר ובגדול, בצבע חם */}
        <div className="w-20 h-20 bg-[#A67C52]/10 rounded-[24px] flex items-center justify-center mx-auto mb-6 shadow-sm">
          <ShoppingBasket className="w-10 h-10 text-[#A67C52]" />
        </div>
        <h2 className="text-2xl font-bold text-black mb-2">רשימות קניות</h2>
        <p className="text-gray-500 mb-8 text-sm">התחבר כדי לנהל את הרשימות המשותפות שלכם בצורה חכמה.</p>
        <button onClick={handleLogin} className="w-full bg-[#A67C52] text-white font-semibold py-4 px-4 rounded-[20px] active:scale-95 transition-all text-base shadow-sm">
          התחברות עם Google
        </button>
      </div>
    </div>
  );

  // מסך הלובי
  if (!currentListId) return (
    <div dir="rtl" className="min-h-screen bg-[#F2F2F7] pb-20" style={{ fontFamily: "'Rubik', sans-serif" }}>
      <div className="max-w-md mx-auto pt-10 px-4">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-black tracking-tight">הרשימות שלי</h1>
          <button onClick={handleLogout} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-red-500 shadow-sm active:scale-95 transition-all">
            <LogOut className="w-4 h-4 ml-0.5" />
          </button>
        </div>

        <div className="bg-white rounded-[24px] overflow-hidden shadow-sm mb-8">
          {myLists.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">אין עדיין רשימות פעילות.</div>
          ) : (
            myLists.map((list, idx) => (
              <div key={list.id}>
                <button onClick={() => selectList(list.id, list.name)} className="w-full p-4 flex justify-between items-center bg-white active:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#A67C52]/10 flex items-center justify-center">
                      <List className="w-5 h-5 text-[#A67C52]" />
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-black text-[17px] block">{list.name}</span>
                      <span className="text-[13px] text-gray-400">קוד: {list.id}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300" />
                </button>
                {idx !== myLists.length - 1 && <div className="h-[1px] bg-gray-100 ml-4" />}
              </div>
            ))
          )}
        </div>

        <div className="space-y-4">
          <form onSubmit={handleCreateList} className="bg-white p-5 rounded-[24px] shadow-sm">
            <h3 className="font-semibold text-black text-[15px] mb-3 flex items-center gap-2"><FolderPlus className="w-4 h-4 text-[#A67C52]"/> יצירת רשימה</h3>
            <div className="flex gap-2 bg-[#767680]/[0.08] p-1.5 rounded-[18px]">
              <input type="text" value={newListName} onChange={(e) => setNewListName(e.target.value)} placeholder="שם הרשימה..." className="flex-1 px-3 bg-transparent text-[15px] outline-none" />
              <button type="submit" disabled={isCreating} className="bg-[#A67C52] text-white px-5 py-2.5 rounded-[14px] text-sm font-semibold active:scale-95 transition-all">צור</button>
            </div>
          </form>

          <form onSubmit={handleJoinList} className="bg-white p-5 rounded-[24px] shadow-sm">
            <h3 className="font-semibold text-black text-[15px] mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-gray-500"/> הצטרפות לרשימה</h3>
            <div className="flex gap-2 bg-[#767680]/[0.08] p-1.5 rounded-[18px]">
              <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="הזן קוד..." className="flex-1 px-3 bg-transparent text-[15px] outline-none uppercase" dir="ltr" />
              <button type="submit" className="bg-gray-200 text-black px-5 py-2.5 rounded-[14px] text-sm font-semibold active:scale-95 transition-all">הצטרף</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  // מסך הרשימה עצמה
  return (
    <div className="min-h-screen bg-[#F2F2F7] pb-24" dir="rtl" style={{ fontFamily: "'Rubik', sans-serif" }}>
      {/* אזור עליון - תפריט דביק בסגנון אפל */}
      <div className="sticky top-0 z-20 bg-[#F2F2F7]/80 backdrop-blur-xl border-b border-gray-200/50 px-4 pt-10 pb-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button onClick={handleLeaveListView} className="flex items-center text-[#A67C52] text-[17px] active:opacity-50 transition-opacity">
            <ChevronRight className="w-6 h-6 -ml-1" /> חזור
          </button>
        </div>
        <button onClick={copyShareInvite} className="w-8 h-8 bg-[#A67C52]/10 rounded-full flex items-center justify-center text-[#A67C52] active:scale-95 transition-all">
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 pt-4 max-w-lg mx-auto">
        <h1 className="text-[34px] font-bold text-black tracking-tight leading-tight">{currentListName}</h1>
        
        {/* קוד השיתוף במקום בולט בתוך הרשימה */}
        <div className="flex items-center gap-2 mt-2 mb-6">
           <button onClick={copyJustCode} className="flex items-center gap-1.5 text-[13px] text-[#A67C52] font-mono bg-[#A67C52]/10 px-2.5 py-1 rounded-lg active:opacity-50 transition-all">
             <Copy className="w-3.5 h-3.5" />
             {currentListId}
           </button>
           <span className="text-[13px] text-gray-400">מוצרים שנותרו: {remainingCount}</span>
        </div>

        <form onSubmit={handleAddItem} className="flex gap-2 mb-8 bg-white p-2 rounded-[24px] shadow-sm items-center border border-gray-100">
          <input type="text" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="מה חסר בבית?" className="flex-[3] py-3 px-4 text-[17px] bg-transparent outline-none min-w-0" />
          <div className="w-[1px] h-8 bg-gray-100 mx-1"></div>
          <input type="text" value={itemQuantity} onChange={(e) => setItemQuantity(e.target.value)} placeholder="כמות" className="flex-1 py-3 px-2 text-center text-[17px] bg-transparent outline-none min-w-[60px]" />
          <button type="submit" className="w-11 h-11 bg-[#A67C52] text-white rounded-[18px] flex items-center justify-center active:scale-95 transition-all shrink-0 shadow-sm"><Plus className="w-6 h-6"/></button>
        </form>

        {items.length === 0 ? (
           <div className="text-center py-12 px-6">
             <ShoppingBasket className="w-12 h-12 mx-auto text-gray-300 mb-4" />
             <p className="text-gray-500 text-[15px]">הרשימה ריקה. אפשר להתחיל להוסיף מוצרים.</p>
           </div>
        ) : (
          <div className="bg-white rounded-[24px] overflow-hidden shadow-sm">
            <AnimatePresence mode="popLayout">
              {sortedItems.map((item, index) => (
                <motion.div key={item.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                  <div className="flex items-center gap-3 p-4 bg-white active:bg-gray-50 cursor-pointer" onClick={() => handleToggleItem(item)}>
                    
                    <div className={`h-6 w-6 rounded-full border-[1.5px] flex items-center justify-center shrink-0 transition-colors ${item.completed ? "border-[#A67C52] bg-[#A67C52]" : "border-gray-300"}`}>
                      {item.completed && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>

                    <div className="flex-1 min-w-0 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className={`text-[17px] tracking-tight ${item.completed ? "line-through text-gray-400" : "text-black font-medium"}`}>{item.name}</span>
                        <span className="text-[12px] text-gray-400 mt-0.5">{item.added_by_name}</span>
                      </div>
                      {item.quantity && <span className="px-2.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[13px] font-medium shrink-0 ml-2">{item.quantity}</span>}
                    </div>

                    <button onClick={(e) => { e.stopPropagation(); handleDeleteItem(item); }} className="p-2 -mr-2 text-gray-300 hover:text-red-500 active:scale-90 transition-all shrink-0">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                  {index !== sortedItems.length - 1 && <div className="h-[1px] bg-gray-100 ml-12" />}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}