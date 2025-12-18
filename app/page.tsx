"use client";
import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Search, Clock, Utensils, PlusCircle, Trash2, Lock, Unlock, X, BookOpen, ChevronRight, Edit3, Save, Plus, ImageIcon, UploadCloud, Info } from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

// --- 画像アップロード部品 ---
const ImageUpload = ({ currentImage, onFileSelect, label, isSmall = false }: { currentImage: string | null, onFileSelect: (file: File) => void, label: string, isSmall?: boolean }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImage);
  useEffect(() => { setPreviewUrl(currentImage); }, [currentImage]);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    onFileSelect(file);
  };
  const containerClass = isSmall ? "w-24 h-24" : "w-full aspect-video md:aspect-square";
  return (
    <div className="space-y-1">
      <span className="text-[10px] uppercase tracking-widest text-stone-400 font-sans">{label}</span>
      <div onClick={() => fileInputRef.current?.click()} className={`${containerClass} bg-stone-50 border border-stone-200 rounded cursor-pointer hover:bg-stone-100 transition-all flex flex-col items-center justify-center relative overflow-hidden group`}>
        {previewUrl ? (
          <><img src={previewUrl} className="w-full h-full object-cover" alt="" /><div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"><UploadCloud size={20} /></div></>
        ) : (
          <div className="text-stone-300 text-[10px] tracking-widest uppercase font-sans">Select Photo</div>
        )}
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
      </div>
    </div>
  );
};

export default function KanbutsuApp() {
  const [mounted, setMounted] = useState(false);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [password, setPassword] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [selectedSteps, setSelectedSteps] = useState<any[]>([]);

  // フォーム用ステート
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("豆");
  const [newKeywords, setNewKeywords] = useState("");
  const [newSoak, setNewSoak] = useState("");
  const [newCook, setNewCook] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newImageUrl, setNewImageUrl] = useState(""); 
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [steps, setSteps] = useState<{ description: string, image_url: string, image_file: File | null }[]>([{ description: "", image_url: "", image_file: null }]);

  useEffect(() => { setMounted(true); if (supabase) fetchRecipes(); }, []);

  const fetchRecipes = async () => {
    const { data } = await supabase!.from('recipes').select('*').order('created_at', { ascending: false });
    if (data) setRecipes(data);
  };

  const openDetail = async (recipe: any) => {
    setSelectedRecipe(recipe);
    const { data } = await supabase!.from('recipe_steps').select('*').eq('recipe_id', recipe.id).order('step_number', { ascending: true });
    setSelectedSteps(data || []);
  };

  const startEdit = async (e: React.MouseEvent, recipe: any) => {
    e.stopPropagation();
    setEditingId(recipe.id); setNewName(recipe.name); setNewCategory(recipe.category);
    setNewKeywords(recipe.keywords?.join(", ") || ""); setNewSoak(recipe.soak_time); setNewCook(recipe.cook_time);
    setNewDesc(recipe.description); setNewImageUrl(recipe.image || ""); setNewImageFile(null);
    const { data } = await supabase!.from('recipe_steps').select('*').eq('recipe_id', recipe.id).order('step_number', { ascending: true });
    setSteps(data && data.length > 0 ? data.map(s => ({ description: s.description, image_url: s.image_url || "", image_file: null })) : [{ description: "", image_url: "", image_file: null }]);
    setShowForm(true);
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!supabase || !file) return null;
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    await supabase.storage.from('recipe-images').upload(fileName, file);
    const { data } = supabase.storage.from('recipe-images').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const saveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    let finalMainImageUrl = newImageUrl;
    if (newImageFile) { const uploaded = await uploadImage(newImageFile); if (uploaded) finalMainImageUrl = uploaded; }
    const recipeData = { name: newName, category: newCategory, keywords: newKeywords.split(",").map(k => k.trim()), soak_time: newSoak, cook_time: newCook, description: newDesc, image: finalMainImageUrl || null };
    let recipeId = editingId;
    if (editingId) { await supabase!.from('recipes').update(recipeData).eq('id', editingId); await supabase!.from('recipe_steps').delete().eq('recipe_id', editingId); }
    else { const { data } = await supabase!.from('recipes').insert([recipeData]).select(); recipeId = data?.[0].id; }
    if (recipeId) {
      const stepData = await Promise.all(steps.filter(s => s.description).map(async (s, index) => {
        let finalStepUrl = s.image_url;
        if (s.image_file) { const uploaded = await uploadImage(s.image_file); if (uploaded) finalStepUrl = uploaded; }
        return { recipe_id: recipeId, step_number: index + 1, description: s.description, image_url: finalStepUrl || null };
      }));
      if (stepData.length > 0) await supabase!.from('recipe_steps').insert(stepData);
    }
    setShowForm(false); resetForm(); fetchRecipes();
  };

  const resetForm = () => {
    setEditingId(null); setNewName(""); setNewSoak(""); setNewCook(""); setNewDesc(""); setNewKeywords(""); setNewImageUrl(""); setNewImageFile(null);
    setSteps([{ description: "", image_url: "", image_file: null }]);
  };

  if (!mounted) return null;
  const getSafeImage = (url: string | null) => (url && url.trim() !== "") ? url : null;

  return (
    <div className="min-h-screen bg-[#fcfaf2] text-[#333] font-serif pb-20 selection:bg-stone-200">
      
      {/* --- 管理バー --- */}
      <div className="bg-stone-100 p-2 flex justify-end gap-2 px-6 border-b border-stone-200">
        {!isAdmin ? (
          <div className="flex items-center gap-2">
            <input type="password" placeholder="Pass" className="text-[10px] p-1 border rounded bg-white font-sans" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button onClick={() => {if(password==="1234"){setIsAdmin(true);setPassword("")}}} className="text-stone-400 hover:text-stone-600"><Lock size={12} /></button>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <button onClick={() => {resetForm(); setShowForm(true);}} className="text-xs bg-stone-800 text-white px-3 py-1 rounded-full flex items-center gap-1 font-sans"><PlusCircle size={14}/> 新レシピ追加</button>
            <button onClick={() => setIsAdmin(false)} className="text-stone-400 hover:text-stone-600"><Unlock size={12} /></button>
          </div>
        )}
      </div>

      <header className="bg-white border-b border-stone-200 py-12 px-6 text-center">
        <p className="text-xs tracking-[0.4em] text-stone-400 mb-2 uppercase font-sans">Kamakura Ishiwata-Shoten</p>
        <h1 className="text-4xl font-bold tracking-widest text-stone-800">石渡商店 乾物帖</h1>
        <p className="mt-4 text-stone-500 italic text-sm">〜 鎌倉の風土が育む、乾物の美味しい知恵 〜</p>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="relative mb-16 max-w-lg mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={20} />
          <input type="text" placeholder="単語を入力（例：豆、お弁当、時短...）" className="w-full pl-12 pr-4 py-4 rounded-full border border-stone-200 shadow-sm focus:ring-2 focus:ring-stone-100 outline-none font-sans bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>

        {/* --- カード一覧（最初のデザインを維持） --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {recipes.filter(r => r.name.includes(searchTerm)).map((recipe) => (
            <article key={recipe.id} onClick={() => openDetail(recipe)} className="group bg-white rounded-lg overflow-hidden border border-stone-100 shadow-sm hover:shadow-md transition-all cursor-pointer relative">
              {isAdmin && (
                <div className="absolute top-3 right-3 z-10 flex gap-2">
                  <button onClick={(e) => startEdit(e, recipe)} className="bg-white/90 text-stone-600 p-2 rounded-full hover:bg-stone-800 hover:text-white shadow-md transition-all"><Edit3 size={14} /></button>
                  <button onClick={async (e) => {e.stopPropagation(); if(confirm("削除しますか？")) { await supabase!.from('recipes').delete().eq('id', recipe.id); fetchRecipes(); }}} className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 shadow-md transition-all"><Trash2 size={14} /></button>
                </div>
              )}
              <div className="aspect-video overflow-hidden bg-stone-50">
                {getSafeImage(recipe.image) ? (
                  <img src={recipe.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-200 bg-stone-50"><BookOpen size={40} /></div>
                )}
              </div>
              <div className="p-8">
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-stone-800 text-white text-[10px] px-2 py-0.5 rounded tracking-widest uppercase font-sans">{recipe.category}</span>
                </div>
                <h3 className="text-2xl font-bold mb-4 group-hover:text-stone-600 transition-colors">{recipe.name}</h3>
                <p className="text-stone-500 text-sm leading-relaxed mb-6 italic line-clamp-2 font-sans">「{recipe.description}」</p>
                <div className="flex justify-between items-center text-stone-400 border-t border-stone-50 pt-4 font-sans text-xs">
                   <div className="flex gap-4 italic"><span className="flex items-center gap-1"><Clock size={12}/> {recipe.soak_time || "—"}</span><span className="flex items-center gap-1"><Utensils size={12}/> {recipe.cook_time || "—"}</span></div>
                   <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* --- 乾物屋の豆知識セクション（足したい部分） --- */}
        <section className="mt-20 p-8 bg-stone-800 text-stone-100 rounded-lg shadow-inner relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 italic">
              <Info size={20} /> 乾物屋の豆知識
            </h2>
            <p className="text-stone-400 text-sm leading-loose max-w-2xl font-sans">
              乾物は「時間を戻す」料理です。急がず、豆がゆっくりと水を吸う音を聞くように。
              石渡商店では、鎌倉の地で代々伝わる「一番美味しく戻る瞬間」を大切にしています。
            </p>
          </div>
          <div className="absolute right-[-20px] bottom-[-20px] opacity-10">
            <BookOpen size={160} />
          </div>
        </section>
      </main>

      {/* --- 詳細表示モーダル（50/50レイアウト） --- */}
      {selectedRecipe && (
        <div className="fixed inset-0 bg-stone-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 md:p-8" onClick={() => setSelectedRecipe(null)}>
          <div className="bg-[#fcfaf2] w-full max-w-4xl max-h-full overflow-y-auto rounded-2xl shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedRecipe(null)} className="absolute top-6 right-6 text-stone-400 hover:text-stone-800 z-10 bg-white/80 p-2 rounded-full"><X /></button>
            <div className="flex flex-col md:flex-row min-h-[500px]">
              <div className="w-full md:w-1/2 aspect-square md:aspect-auto bg-stone-200">
                <img src={selectedRecipe.image || "https://images.unsplash.com/photo-1547592166-23ac45744acd?q=80&w=800"} className="w-full h-full object-cover" alt="" />
              </div>
              <div className="w-full md:w-1/2 p-10 flex flex-col">
                <div className="mb-6">
                  <span className="text-xs tracking-widest text-stone-400 border-b border-stone-200 pb-1 uppercase font-sans">{selectedRecipe.category}</span>
                  <h2 className="text-3xl font-bold mt-4 text-stone-800">{selectedRecipe.name}</h2>
                </div>
                <p className="text-stone-600 leading-loose italic mb-10 font-sans">「{selectedRecipe.description}」</p>
                <div className="space-y-8 flex-grow">
                  <h4 className="text-[10px] uppercase tracking-[0.2em] text-stone-400 border-b border-stone-100 pb-2 font-bold font-sans">作り方の手順</h4>
                  <div className="space-y-6">
                    {selectedSteps.map((step, idx) => (
                      <div key={idx} className="flex gap-4 items-start border-b border-stone-50 pb-4 last:border-0">
                        <div className="flex-1 flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-stone-800 text-white rounded-full flex items-center justify-center font-sans font-bold text-[10px] italic">{idx + 1}</span>
                          <p className="text-stone-700 text-sm leading-relaxed font-sans">{step.description}</p>
                        </div>
                        {getSafeImage(step.image_url) && (
                          <div className="flex-shrink-0 w-20 h-20 rounded shadow-sm border border-stone-100 overflow-hidden bg-white">
                            <img src={step.image_url!} className="w-full h-full object-cover" alt="" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-8 py-6 border-t border-stone-200 mt-8 font-sans">
                  <div><h4 className="text-[10px] uppercase text-stone-400 mb-1">戻し時間</h4><p className="text-lg text-stone-800">{selectedRecipe.soak_time || "—"}</p></div>
                  <div><h4 className="text-[10px] uppercase text-stone-400 mb-1">調理時間</h4><p className="text-lg text-stone-800">{selectedRecipe.cook_time || "—"}</p></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- 編集・作成フォーム --- */}
      {showForm && (
        <div className="fixed inset-0 bg-stone-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans text-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-8 relative max-h-[90vh] overflow-y-auto shadow-2xl">
            <button onClick={() => setShowForm(false)} className="absolute top-5 right-5 text-stone-300"><X /></button>
            <h2 className="text-2xl font-bold mb-8 italic text-stone-800 font-serif">{editingId ? "レシピを編集" : "新レシピの登録"}</h2>
            <form onSubmit={saveRecipe} className="space-y-6">
              <div className="flex flex-col md:flex-row gap-6 border-b pb-6">
                <div className="flex-1 space-y-4">
                  <input placeholder="料理名" className="w-full p-2 border-b outline-none focus:border-stone-800 text-lg" value={newName} onChange={e => setNewName(e.target.value)} required />
                  <div className="grid grid-cols-2 gap-4">
                    <select className="p-2 bg-stone-50 border rounded" value={newCategory} onChange={e => setNewCategory(e.target.value)}><option>豆</option><option>海藻</option><option>野菜</option><option>魚介</option></select>
                    <input placeholder="タグ" className="p-2 bg-stone-50 border rounded" value={newKeywords} onChange={e => setNewKeywords(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <input placeholder="戻し時間" className="p-2 bg-stone-50 border rounded" value={newSoak} onChange={e => setNewSoak(e.target.value)} />
                    <input placeholder="調理時間" className="p-2 bg-stone-50 border rounded" value={newCook} onChange={e => setNewCook(e.target.value)} />
                  </div>
                </div>
                <div className="w-48 flex-shrink-0"><ImageUpload label="メイン写真" currentImage={newImageUrl} onFileSelect={setNewImageFile} /></div>
              </div>
              <textarea placeholder="一言説明" className="w-full p-3 bg-stone-50 border rounded h-20 outline-none" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
              <div className="space-y-4">
                <h4 className="font-bold text-stone-600 flex items-center gap-2">手順の追加</h4>
                {steps.map((step, idx) => (
                  <div key={idx} className="p-4 bg-stone-50 rounded flex gap-4 items-start relative border border-stone-100 group">
                    <button type="button" onClick={() => setSteps(steps.filter((_, i) => i !== idx))} className="absolute top-1 right-1 text-stone-300 opacity-0 group-hover:opacity-100"><X size={14}/></button>
                    <span className="text-stone-300 font-bold italic">#{idx+1}</span>
                    <textarea placeholder="作り方" className="flex-1 p-2 bg-white border rounded h-20 outline-none" value={step.description} onChange={e => {const n=[...steps]; n[idx].description=e.target.value; setSteps(n);}} />
                    <ImageUpload label="写真" isSmall currentImage={step.image_url} onFileSelect={(f) => {const n=[...steps]; n[idx].image_file=f; n[idx].image_url=URL.createObjectURL(f); setSteps(n);}} />
                  </div>
                ))}
                <button type="button" onClick={() => setSteps([...steps, {description:"", image_url:"", image_file:null}])} className="w-full py-2 border border-dashed border-stone-300 rounded text-stone-400 text-xs">+ 手順を追加</button>
              </div>
              <button type="submit" className="w-full bg-stone-800 text-white py-4 rounded font-bold tracking-[0.3em] hover:bg-stone-700 transition-all shadow-lg active:scale-[0.98]">データベースに保存する</button>
            </form>
          </div>
        </div>
      )}

      <footer className="py-16 text-center text-stone-400 text-[10px] tracking-[0.3em] uppercase font-sans">
        © Kamakura Ishiwata-Shoten All Rights Reserved.
      </footer>
    </div>
  );
}