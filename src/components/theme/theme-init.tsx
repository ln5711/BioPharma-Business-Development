import { THEME_COOKIE, LEGACY_THEME_KEY } from "@/lib/theme";

/**
 * Runs before first paint (it is a plain synchronous <script> in <head>).
 * Resolves the effective theme and stamps `data-theme` on <html> so there is no
 * flash and no server/client mismatch:
 *
 *  1. `nw-theme` cookie present → the server already rendered the right thing;
 *     only "system" needs correcting against the OS preference.
 *  2. no cookie but legacy `obd-theme` localStorage value → migrate it into the
 *     cookie and apply it.
 *  3. nothing stored → follow the OS ("system").
 */
export function ThemeInit() {
  const js = `(function(){try{
    var d=document.documentElement;
    var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]+)/);
    var choice=m?decodeURIComponent(m[1]):null;
    if(!choice){
      var legacy=null;try{legacy=localStorage.getItem('${LEGACY_THEME_KEY}');}catch(e){}
      if(legacy==='light'||legacy==='dark'){
        choice=legacy;
        document.cookie='${THEME_COOKIE}='+choice+';path=/;max-age=31536000;samesite=lax';
      }else{choice='system';}
    }
    var resolved=choice;
    if(choice==='system'){
      resolved=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches)?'light':'dark';
    }
    d.dataset.theme=resolved;
  }catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
