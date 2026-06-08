import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { db, auth, googleProvider } from './firebase';
import { AnimatePresence, motion } from 'framer-motion';
import { ShoppingBasket, Sparkles, Trash2, Plus, Check, LogOut, Share2, Users, Home } from 'lucide-react';

export default function App() {
  const [items, setItems] = useState([]);
  const [itemName, setItemName] = useState('');
  const [itemQuantity, setItemQuantity] = useState('');
  const [joinCode, setJoinCode] = useState(''); // שדה לקוד הצטרפות
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // חילוץ מזהה הרשימה מה-URL במידה ונועם תלחץ על קישור
  const urlParams = new URLSearchParams(window.location.search);
  const listIdFromUrl = urlParams.get('listId');

  const [currentListId, setCurrentListId] = useState(
    listIdFromUrl || localStorage.getItem('current_list_id') || null
  );

  // האזנה למצב חיבור משתמש
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  // אם נכנסו דרך קישור - שמור את ה-ID ונקה את שורת הכתובת
  useEffect(() => {
    if (listIdFromUrl) {
      setCurrentListId(listIdFromUrl);
      localStorage.setItem('current_list_id', listIdFromUrl);
      window.history.replaceState({}, document.title, window.location.origin);
    }
  }, [listIdFromUrl]);

  // טעינת הפריטים רק אם יש משתמש מחובר ויש רשימה פעילה
  useEffect(() => {
    if (!user || !currentListId) return;

    const q = query(collection(db, 'lists', currentListId, 'items'), orderBy('createdAt', 'desc'));
    const unsubscribeSpecs = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribeSpecs();
  }, [user, currentListId]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = () => {
    signOut(auth);
    localStorage.removeItem('current_list_id');
    setCurrentListId(null);
  };

    // 1. יצירת רשימה עם קוד ייחודי (למשל: שם המשתמש + 3 ספרות רנדומליות)
  const handleCreateMyList = () => {
    const randomCode = user.displayName?.split(' ')[0].toUpperCase() + '-' + Math.floor(100 + Math.random() * 900);
    setCurrentListId(randomCode);
    localStorage.setItem('current_list_id', randomCode);
  };

  
  // 2. הצטרפות לרשימה קיימת (הופכים את הקוד לאותיות גדולות ליתר ביטחון)
  const handleJoinList = () => {
    if (joinCode.trim() === '') return;
    const cleanCode = joinCode.trim().toUpperCase();
    setCurrentListId(cleanCode);
    localStorage.setItem('current_list_id', cleanCode);
  };

  const handleLeaveList = () => {
    setCurrentListId(null);
    localStorage.removeItem('current_list_id');
  };

  /// 3. הזמנה מסודרת שכוללת את הקוד הקריא
  const copyShareInvite = () => {
    const textToShare = `היי! בוא/י נשתף רשימת קניות 🛒\n\nקוד ההצטרפות שלי הוא: *${currentListId}*\n\nאפשר להזין אותו באפליקציה כאן:\n${window.location.origin}`;
    
    navigator.clipboard.writeText(textToShare);
    alert('הקוד וההזמנה הועתקו! 💬');
  };

  // --- פעולות הרשימה ---
  const handleAdd = async (e) => {
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

  const toggleItem = async (item) => {
    if (!currentListId) return;
    await updateDoc(doc(db, 'lists', currentListId, 'items', item.id), {
      completed: !item.completed
    });
  };

  const deleteItem = async (item) => {
    if (!currentListId) return;
    await deleteDoc(doc(db, 'lists', currentListId, 'items', item.id));
  };

  const sortedItems = [...items].sort((a, b) => {
    if (a.completed === b.completed) return 0;
    return a.completed ? 1 : -1;
  });

  // 1. מסך טעינה
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FDF8F3] flex items-center justify-center font-rubik">
        <div className="w-10 h-10 border-4 border-[#ACD1AF]/20 border-t-[#ACD1AF] rounded-full animate-spin" />
      </div>
    );
  }

  // 2. מסך התחברות (אם לא מחובר)
  if (!user) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#FDF8F3] flex items-center justify-center p-6 font-rubik">
        <div className="bg-white p-8 rounded-[32px] shadow-xl w-full max-w-sm text-center border border-slate-100">
          <div className="w-16 h-16 bg-[#ACD1AF]/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <ShoppingBasket className="w-8 h-8 text-[#ACD1AF]" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">רשימת הקניות שלנו</h2>
          <p className="text-slate-500 mb-8 text-sm">כדי לראות ולעדכן את הרשימה בזמן אמת, יש להתחבר למערכת</p>
          
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

  // 3. הלובי - מסך הפתיחה במידה ואין רשימה פעילה
  if (!currentListId) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#FDF8F3] flex items-center justify-center p-6 font-rubik">
        <div className="bg-white p-8 rounded-[32px] shadow-xl w-full max-w-sm border border-slate-100">
          
          {/* פרופיל וברכה */}
          <div className="text-center mb-8">
            {user.photoURL ? (
              <img src={user.photoURL} alt="profile" referrerPolicy="no-referrer" className="w-20 h-20 rounded-full mx-auto mb-4 border-4 border-[#FDF8F3] shadow-sm object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-2xl mx-auto mb-4">
                {user.displayName?.charAt(0)}
              </div>
            )}
            <h2 className="text-2xl font-bold text-slate-800">היי {user.displayName?.split(' ')[0]}! 👋</h2>
            <p className="text-slate-500 mt-1 text-sm">בחר איך תרצה להתחיל</p>
          </div>

          <div className="space-y-5">
            {/* אפשרות 1: פתח רשימה משלי */}
            <button 
              onClick={handleCreateMyList} 
              className="w-full flex items-center gap-4 bg-[#ACD1AF]/20 text-[#2c4c3b] p-4 rounded-2xl hover:bg-[#ACD1AF]/30 transition-all text-right"
            >
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
                <Plus className="w-6 h-6 text-[#ACD1AF]" />
              </div>
              <div>
                <h3 className="font-bold text-lg">הרשימה שלי</h3>
                <p className="text-xs text-[#2c4c3b]/70">פתח רשימה חדשה תחת שמך</p>
              </div>
            </button>

            {/* קו הפרדה חזותי */}
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-slate-100"></div>
              <span className="flex-shrink-0 mx-4 text-slate-300 text-sm font-medium">או</span>
              <div className="flex-grow border-t border-slate-100"></div>
            </div>

            {/* אפשרות 2: הצטרף לרשימה */}
            <div className="bg-[#FAF5F0] p-4 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-2.5 mb-3">
                <Users className="w-4 h-4 text-slate-500" />
                <h3 className="font-bold text-slate-700 text-sm">הצטרף לרשימה קיימת</h3>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="הדבק קוד פה..."
                  className="flex-1 p-3 rounded-xl text-sm border-none bg-white focus:ring-2 focus:ring-[#ACD1AF]/40 outline-none text-left font-mono"
                  dir="ltr"
                />
                <button 
                  onClick={handleJoinList} 
                  className="bg-[#334155] text-white px-5 rounded-xl text-sm font-bold hover:bg-slate-700 transition-all shrink-0"
                >
                  הצטרף
                </button>
              </div>
            </div>
          </div>
          
          <button onClick={handleLogout} className="w-full text-center text-slate-400 text-sm hover:text-red-500 pt-6 flex items-center justify-center gap-1.5 transition-colors">
            <LogOut className="w-4 h-4" />
            התנתק מהחשבון
          </button>
        </div>
      </div>
    );
  }

  // 4. מסך הרשימה עצמה
  const remainingCount = items.filter(item => !item.completed).length;
  const completedCount = items.filter(item => item.completed).length;

  return (
    <div className="min-h-screen bg-[#FDF8F3] text-slate-900 pb-20 font-rubik" dir="rtl">
      <div className="relative max-w-lg mx-auto px-4 py-8 md:py-14">
        
        {/* כותרת וכפתור חזרה ללובי */}
        <div className="flex items-center justify-between mb-6">
            <button 
              onClick={handleLeaveList}
              className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-800 transition-all"
              title="חזור למסך הראשי"
            >
              <Home className="w-5 h-5" />
            </button>
            <div className="flex flex-col text-right">
              <h1 className="text-2xl font-extrabold text-slate-900">
                רשימת קניות
              </h1>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5 justify-end">
                <Sparkles className="w-3 h-3 text-[#ACD1AF]" />
                משותף עם כל הבית
              </p>
            </div>
        </div>

        {/* תיבת הזמנת שותף */}
        <div className="mb-8 bg-white p-4 rounded-[20px] shadow-sm border border-slate-100 flex items-center justify-between">
           <div className="flex flex-col text-right">
             <span className="text-xs text-slate-400 font-medium mb-0.5">רוצה לשתף?</span>
             <span className="text-sm font-bold text-slate-700">הזמן חבר לרשימה</span>
           </div>
           <button 
             onClick={copyShareInvite} 
             className="flex items-center gap-2 bg-[#ACD1AF]/20 text-[#2c4c3b] px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-[#ACD1AF]/30 transition-all"
           >
             <Share2 className="w-4 h-4" />
             העתק הזמנה
           </button>
        </div>

                {/* טופס הוספה מתוקן ומותאם לנייד */}
        <form onSubmit={handleAdd} className="flex gap-2 mb-8 p-3 bg-white/70 backdrop-blur-sm rounded-3xl shadow-lg border border-white/20 items-center">
          <input
            type="text"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="פריט..."
            className="flex-[3] p-4 rounded-xl text-lg border-none bg-[#FAF5F0] focus:ring-4 focus:ring-[#ACD1AF]/10 outline-none transition-all min-w-0"
          />
          <input
            type="text"
            value={itemQuantity}
            onChange={(e) => setItemQuantity(e.target.value)}
            placeholder="כמות"
            className="flex-1 p-4 rounded-xl text-lg border-none bg-[#FAF5F0] text-center focus:ring-4 focus:ring-[#ACD1AF]/10 outline-none transition-all min-w-[60px]"
          />
          <button 
            type="submit"
            className="w-12 h-12 bg-[#ACD1AF]/70 text-white rounded-xl flex items-center justify-center hover:bg-[#ACD1AF] transition-colors shrink-0"
          >
            <Plus className="w-6 h-6" />
          </button>
        </form>

        {/* סטטיסטיקות */}
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

        {/* רשימת פריטים */}
        {items.length === 0 ? (
           <div className="text-center py-16 bg-white rounded-3xl border border-slate-100 border-dashed">
             <ShoppingBasket className="w-12 h-12 mx-auto text-slate-300 mb-4" />
             <p className="text-slate-500">הרשימה ריקה לגמרי!</p>
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
                  `} onClick={() => toggleItem(item)}>
                    
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
                          <span className="w-6 h-6 bg-[#A67C52] text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                            {item.quantity}
                          </span>
                        )}
                      </div>
                      {item.added_by_name && (
                        <div className="flex items-center gap-1.5 mt-1 justify-start">
                          <span className="text-xs text-slate-400 tracking-wide">
                            הוסף ע"י {item.added_by_name}
                          </span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation(); 
                        deleteItem(item);
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