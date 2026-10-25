import {createContext,useContext,useLayoutEffect,useState} from 'react';
import type {ReactNode} from 'react';

type Theme='light'|'dark';
const ThemeContext=createContext<{theme:Theme;toggle:()=>void}>({theme:'light',toggle:()=>{}});
function initialTheme():Theme{
 try{const saved=localStorage.getItem('gridaid-theme');if(saved==='light'||saved==='dark')return saved;}catch{/* Browsers can disable preference storage. */}
 return window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
}
export function ThemeProvider({children}:{children:ReactNode}){
 const [theme,setTheme]=useState<Theme>(initialTheme);
 useLayoutEffect(()=>{
  document.documentElement.dataset.theme=theme;
  document.documentElement.style.colorScheme=theme;
  try{localStorage.setItem('gridaid-theme',theme);}catch{/* The current page still uses the selected theme. */}
 },[theme]);
 return <ThemeContext.Provider value={{theme,toggle:()=>setTheme(t=>t==='dark'?'light':'dark')}}>{children}</ThemeContext.Provider>;
}
export function ThemeToggle(){
 const {theme,toggle}=useContext(ThemeContext),dark=theme==='dark';
 return <button className="theme-toggle" type="button" aria-label={`Switch to ${dark?'light':'dark'} mode`} aria-pressed={dark} onClick={toggle}><span aria-hidden="true">{dark?'☀':'☾'}</span><span className="theme-toggle-label">{dark?'Light mode':'Dark mode'}</span></button>;
}
