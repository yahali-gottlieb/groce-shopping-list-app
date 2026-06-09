import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, getDoc, addDoc, deleteDoc, updateDoc, query, orderBy } from 'firebase/firestore';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { db, auth, googleProvider } from './firebase';
import { AnimatePresence, motion } from 'framer-motion';
import { ShoppingBasket, Sparkles, Trash2, Plus, Check, LogOut, Share2, Users, Home, FolderPlus, List } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // ניהול רשימות (Lobby)
  const [myLists, setMyLists] = useState([]);
  const [currentListId, setCurrentListId] = useState(localStorage.getItem('current_list_id') || null);
  const [currentListName, setCurrentListName] = useState(localStorage.getItem('current_list_name') || '');
  const [newListName, setNewListName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // ניהול פריטים בתוך רשימה
  const [items, setItems] = useState([]);
  const [itemName, setItemName] = useState('');
  const [itemQuantity, setItemQuantity] = useState('');

  // 1. האזנה למצב החיבור של המשתמש
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  // 2. טעינת כל הרשימות שהמשתמש משויך אליהן בענן (Firebase)
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'myLists'), orderBy('joinedAt', 'desc'));
    const unsubscribeLists = onSnapshot(q, (snapshot) => {
      setMyLists(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribeLists();
  }, [user]);

  // 3. טעינת הפריטים בזמן אמת עבור הרשימה שנבחרה
  useEffect(() => {
    if (!user || !currentListId) return;
    const q = query(collection(db, 'lists', currentListId, 'items'), orderBy('createdAt', 'desc'));
    const unsubscribeItems = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribeItems();
  }, [user, currentListId]);

  // --- מנגנון התחברות ---
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = () => {
    signOut(auth);
    localStorage.clear();
    setCurrentListId(null);
    setCurrentListName('');
  };

  // --- לוגיקת ניהול רשימות (לובי) ---
  const handleCreateList = async (e) => {
    e.preventDefault();
    if (newListName.trim() === '') return;
    setIsCreating(true);

    try {
      // יצירת קוד ידידותי וקריא: שם פרטי באותיות גדולות + 3 ספרות
      const userFirstName = user.displayName?.split(' ')[0].toUpperCase() || 'LIST';
      const randomNum = Math.floor(100 + Math.random() * 900);
      const uniqueCode = `${userFirstName}-${randomNum}`;

      // א. יצירת מסמך הרשימה הראשי בענן
      await setDoc(doc(db, 'lists', uniqueCode), {
        name: newListName,
        createdBy: user.uid,
        createdAt: new Date()
      });

      // ב. שיוך הרשימה החדשה לפרופיל האישי של המשתמש לסנכרון עתידי
      await setDoc(doc(db, 'users', user.uid, 'myLists', uniqueCode), {
        name: newListName,
        joinedAt: new Date()
      });

      // ג. כניסה ישירה לרשימה שנוצרה
      selectList(uniqueCode, newListName);
      setNewListName('');
    } catch (error) {
      console.error("Error creating list:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinList = async (e) => {
    e.preventDefault();
    if (joinCode.trim() === '') return;
    const cleanCode = joinCode.trim().toUpperCase();

    try {
      // בדיקה האם הרשימה קיימת במאגר הגלובלי
      const listDoc = await getDoc(doc(db, 'lists', cleanCode));
      
      if (listDoc.exists()) {
        const listData = listDoc.data();
        
        // שיוך הרשימה הקיימת לפרופיל של המשתמש המצטרף
        await setDoc(doc(db, 'users', user.uid, 'myLists', cleanCode), {
          name: listData.name,
          joinedAt: new Date()
        });

        selectList(cleanCode, listData.name);
        setJoinCode('');
      } else {
        alert('קוד הרשימה לא נמצא. ודא שהקוד הוקלד בצורה מדויקת! 🔍');
      }
    } catch (error) {
      console.error("Error joining list:", error);
    }
  };

  const selectList = (id, name) => {
    setCurrentListId(id);
    setCurrentListName(name);
    localStorage.setItem('current_list_id', id);
    localStorage.setItem('current_list_name', name);
  };

  const handleLeaveListView = () => {
    setCurrentListId(null);
    setCurrentListName('');
    localStorage.removeItem('current_list_id');
    localStorage.removeItem('current_list_name');
  };

  const copyShareInvite = () => {
    const textToShare = `היי! בוא/י נשתף רשימת קניות 🛒\n\nשם הרשימה: *${currentListName}*\nקוד ההצטרפות באפליקציה הוא: *${currentListId}*\n\nלהורדה וכניסה:\n${window.location.origin}`;
    navigator.clipboard.writeText(textToShare);
    alert('קוד ההזמנה הועתק ללוח! עכשיו אפשר להדביק אותו ישירות בוואטסאפ 💬');
  };

  // --- לוגיקת ניהול פריטים ---
  const handleAddItem = async (e) => {
    e.preventDefault();
    if (itemName.trim() === '' || !currentListId) return;

    await addDoc(collection(db, 'lists', currentListId, 'items'), {
      name: itemName,
      quantity: itemQuantity,
      completed: false,
      added_by_name: user?.displayName?.split(' ')[0] || 'שותף',
      createdAt: new Date()
    });
    setItemName('');
    setItemQuantity('');
  };

  const handleToggleItem = async (item) => {
    await updateDoc(doc(db, 'lists', currentListId, 'items', item.id), {
      completed: !item.completed
    });
  };

  const handleDeleteItem = async (item) => {
    await deleteDoc(doc(db, 'lists', currentListId, 'items', item.id));
  };

  const sortedItems = [...items].sort((a, b) => {
    if (a.completed === b.completed) return 0;
    return a.completed ? 1 : -1;
  });

  // --- מסכי רינדור ---

  // 1. מסך טעינת אימות
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FDF8F3] flex items-center justify-center font-rubik">
        <div className="w-10 h-10 border-4 border-[#ACD1AF]/20 border-t-[#ACD1AF] rounded-full animate-spin" />
      </div>
    );
  }

  // 2. מסך התחברות ראשוני
  if (!user) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#FDF8F3] flex items-center justify-center p-6 font-rubik">
        <div className="bg-white p-8 rounded-[32px] shadow-xl w-full max-w-sm text-center border border-slate-100">
          <div className="w-16 h-16 bg-[#ACD1AF]/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <ShoppingBasket className="w-8 h-8 text-[#ACD1AF]" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">רשימת הקניות שלנו</h2>
          <p className="text-slate-500 mb-8 text-sm">כדי לראות ולעדכן את הרשימות בזמן אמת, יש להתחבר למערכת</p>
          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white text-slate-700 font-semibold py-3.5 px-4 rounded-2xl border border-slate-200 shadow-sm hover:bg-slate-50 transition-all text-base"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.866-3.577-7.866-8s3.536-8 7.866-8c2.46 0 4.105 1.025 5.047 1.926l3.227-3.227C18.263.956 15.446 0 12.24 0 5.58 0 0 5.37 0 12s5.58 12 12.24 12c6.96 0 11.57-4.854 11.57-11.77 0-.795-.085-1.4-.195-1.945H12.24z"/>
            </svg>
            התחברות עם Google
          </button>
        </div>
      </div>
    );
  }

  // 3. מסך הלובי (מרכז הרשימות) - מוצג כשאין רשימה פעילה שנבחרה
  if (!currentListId) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#FDF8F3] p-6 font-rubik">
        <div className="max-w-md mx-auto pt-6">
          
          {/* פרופיל משתמש עליון */}
          <div className="flex items-center justify-between mb-8 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-3">
              {user.photoURL && (
                <img src={user.photoURL} alt="profile" referrerPolicy="no-referrer" className="w-10 h-10 rounded-full border border-slate-200 object-cover" />
              )}
              <div className="text-right">
                <h2 className="font-bold text-slate-800 text-sm">היי, {user.displayName?.split(' ')[0]} 👋</h2>
                <p className="text-xs text-slate-400">ניהול הרשימות המשותפות</p>
              </div>
            </div>
            <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 p-2 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          <h1 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-2">
            <ShoppingBasket className="w-6 h-6 text-[#ACD1AF]" />
            הרשימות שלי
          </h1>

          {/* הצגת רשימת הרשימות הקיימות */}
          <div className="space-y-3 mb-8">
            {myLists.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-200 p-6">
                <p className="text-slate-400 text-sm">אין לך עדיין רשימות פעילות. צור רשימה חדשה או הצטרף לקיימת למטה!</p>
              </div>
            ) : (
              myLists.map(list => (
                <motion.div 
                  key={list.id}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => selectList(list.id, list.name)}
                  className="w-full p-5 bg-white rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center cursor-pointer hover:border-[#ACD1AF]/40 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#ACD1AF]/10 flex items-center justify-center">
                      <List className="w-5 h-5 text-[#ACD1AF]" />
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-800 block text-base">{list.name}</span>
                      <span className="text-xs font-mono text-slate-400">קוד: {list.id}</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 text-xs font-bold">
                    ➔
                  </div>
                </motion.div>
              ))
            )}
          </div>

          {/* טפסי פעולה בלובי */}
          <div className="space-y-4">
            {/* טופס 1: יצירת רשימה חדשה עם שם */}
            <form onSubmit={handleCreateList} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-[#ACD1AF]" />
                יצירת רשימה חדשה
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="למשל: קניות לבית, על האש לשבת..."
                  className="flex-1 p-3.5 rounded-xl text-sm border-none bg-[#FAF5F0] focus:ring-2 focus:ring-[#ACD1AF]/40 outline-none"
                />
                <button 
                  type="submit" 
                  disabled={isCreating}
                  className="bg-[#ACD1AF] text-white px-5 rounded-xl text-sm font-bold hover:bg-[#ACD1AF]/90 transition-all disabled:opacity-50"
                >
                  צור
                </button>
              </div>
            </form>

            {/* טופס 2: הצטרפות לרשימה של שותף באמצעות קוד */}
            <form onSubmit={handleJoinList} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-500" />
                הצטרפות לרשימה קיימת
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="הזן קוד (למשל: YAHALI-482)"
                  className="flex-1 p-3.5 rounded-xl text-sm border-none bg-[#FAF5F0] focus:ring-2 focus:ring-slate-400 outline-none uppercase font-mono text-left"
                  dir="ltr"
                />
                <button 
                  type="submit" 
                  className="bg-slate-700 text-white px-5 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all"
                >
                  הצטרף
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    );
  }

  // 4. מסך תצוגת הרשימה הפעילה (Active List)
  const remainingCount = items.filter(item => !item.completed).length;
  const completedCount = items.filter(item => item.completed).length;

  return (
    <div className="min-h-screen bg-[#FDF8F3] text-slate-900 pb-20 font-rubik" dir="rtl">
      <div className="relative max-w-lg mx-auto px-4 py-8 md:py-14">
        
        {/* סרגל ניווט עליון בתוך הרשימה */}
        <div className="flex items-center justify-between mb-6">
            <button 
              onClick={handleLeaveListView} 
              className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-800 transition-all"
              title="חזור למרכז הרשימות"
            >
              <Home className="w-5 h-5" />
            </button>
            <div className="flex flex-col text-right">
              <h1 className="text-2xl font-black text-slate-900">{currentListName}</h1>
              <p className="text-xs text-slate-400 font-mono mt-0.5">קוד הצטרפות: {currentListId}</p>
            </div>
        </div>

        {/* וידג'ט שיתוף והזמנה מהירה */}
        <div className="mb-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
           <div className="flex flex-col text-right">
             <span className="text-xs text-slate-400 font-medium mb-0.5">שיתוף הרשימה</span>
             <span className="text-sm font-bold text-slate-700">רוצה להזמין שותף/ה?</span>
           </div>
           <button 
             onClick={copyShareInvite} 
             className="flex items-center gap-2 bg-[#ACD1AF]/20 text-[#2c4c3b] px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-[#ACD1AF]/30 transition-all"
           >
             <Share2 className="w-4 h-4" />
             העתק קוד הזמנה
           </button>
        </div>

        {/* טופס הוספת פריט (מותאם מובייל למניעת גלישה) */}
        <form onSubmit={handleAddItem} className="flex gap-2 mb-8 p-3 bg-white/70 backdrop-blur-sm rounded-3xl shadow-lg border border-white/20 items-center">
          <input 
            type="text" 
            value={itemName} 
            onChange={(e) => setItemName(e.target.value)} 
            placeholder="פריט..." 
            className="flex-[3] p-4 rounded-xl border-none bg-[#FAF5F0] outline-none min-w-0 text-lg" 
          />
          <input 
            type="text" 
            value={itemQuantity} 
            onChange={(e) => setItemQuantity(e.target.value)} 
            placeholder="כמות" 
            className="flex-1 p-4 rounded-xl border-none bg-[#FAF5F0] text-center outline-none min-w-[60px] text-lg" 
          />
          <button 
            type="submit" 
            className="w-12 h-12 bg-[#ACD1AF]/70 text-white rounded-xl flex items-center justify-center hover:bg-[#ACD1AF] transition-colors shrink-0"
          >
            <Plus className="w-6 h-6" />
          </button>
        </form>

        {/* סטטיסטיקות הרשימה */}
        <div className="flex gap-2 mb-6 justify-end">
          <div className="px-4 py-1.5 bg-[#ACD1AF]/20 text-slate-700 rounded-full text-sm font-semibold flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#ACD1AF]"></div>
            {remainingCount} נותרו
          </div>
          <div className="px-4 py-1.5 bg-slate-200 text-slate-700 rounded-full text-sm font-semibold flex items-center gap-1.5">
             <Check className="w-3 h-3" />
            {completedCount} הושלמו
          </div>
        </div>

        {/* לולאת פריטים עם אנימציות */}
        {items.length === 0 ? (
           <div className="text-center py-16 bg-white rounded-3xl border border-slate-100 border-dashed">
             <ShoppingBasket className="w-12 h-12 mx-auto text-slate-300 mb-4" />
             <p className="text-slate-500">הרשימה ריקה לגמרי! הוסף מוצרים למעלה.</p>
           </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {sortedItems.map((item, index) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 12, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -40, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: index * 0.03, ease: "easeOut" }}
                  className="group"
                >
                  <div className={`flex items-center gap-4 p-5 rounded-3xl transition-all duration-300 border hover:shadow-md cursor-pointer
                    ${item.completed ? "bg-slate-100/50 border-slate-200/50 opacity-75" : "bg-white border-slate-200 shadow-sm"}
                  `} onClick={() => handleToggleItem(item)}>
                    
                    <div className={`h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all duration-200 shrink-0
                      ${item.completed ? "border-slate-300 bg-[#FAF5F0]" : "border-slate-300 bg-white"}
                    `}>
                      {item.completed && <Check className="w-4 h-4 text-slate-600" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className={`text-lg font-semibold transition-all duration-300
                          ${item.completed ? "line-through text-slate-400" : "text-slate-800"}
                        `}>
                          {item.name}
                        </span>
                        {item.quantity && (
                          <span className="px-2 py-0.5 bg-[#A67C52] text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                            {item.quantity}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-1 justify-start text-xs text-slate-400">
                        <span>הוסף ע"י {item.added_by_name}</span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation(); 
                        handleDeleteItem(item);
                      }}
                      className="h-10 w-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200 shrink-0"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}