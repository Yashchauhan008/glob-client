import { useEffect, useMemo, useRef, useState } from 'react'
import { API_URL, api, authHeaders } from '../api'
import { useTheme } from '../theme'

export type Widget = { id: string; title: string; html: string; data: Record<string, string> }

/**
 * Runs inside the block's iframe, before the person's own code. A sandboxed page may not use the browser's real
 * localStorage, so this replaces it with one that starts from the data saved on the server and reports every change
 * back to the page, which saves it. To the pasted code it looks exactly like normal localStorage.
 */
const SHIM = `(function(){
var ID=__ID__,DATA=__DATA__;
function mk(persist){
  var store=Object.create(null),timer,pending=false;
  if(persist)for(var k in DATA)store[k]=String(DATA[k]);
  function post(){pending=false;parent.postMessage({glob:'storage',id:ID,data:Object.assign({},store)},'*')}
  // tell the page at once, then at most every 150ms, so even the very last change before leaving is reported
  function sync(){if(!persist)return;if(timer){pending=true;return}post();timer=setTimeout(function(){timer=0;if(pending)post()},150)}
  if(persist)addEventListener('pagehide',function(){if(pending)post()});
  var api={
    getItem:function(k){k=String(k);return Object.prototype.hasOwnProperty.call(store,k)?store[k]:null},
    setItem:function(k,v){store[String(k)]=String(v);sync()},
    removeItem:function(k){delete store[String(k)];sync()},
    clear:function(){for(var k in store)delete store[k];sync()},
    key:function(i){var ks=Object.keys(store);return i in ks?ks[i]:null}
  };
  return new Proxy(api,{
    get:function(t,p){if(p==='length')return Object.keys(store).length;if(p in t)return t[p];return typeof p==='string'&&p in store?store[p]:undefined},
    set:function(t,p,v){if(typeof p==='string'){store[p]=String(v);sync()}return true},
    deleteProperty:function(t,p){if(typeof p==='string'){delete store[p];sync()}return true},
    has:function(t,p){return p in t||(typeof p==='string'&&p in store)},
    ownKeys:function(){return Object.keys(store)},
    getOwnPropertyDescriptor:function(t,p){return typeof p==='string'&&p in store?{value:store[p],enumerable:true,configurable:true,writable:true}:undefined}
  });
}
var local=mk(true),session=mk(false);
Object.defineProperty(window,'localStorage',{configurable:true,get:function(){return local}});
Object.defineProperty(window,'sessionStorage',{configurable:true,get:function(){return session}});
function size(){var d=document.documentElement,b=document.body;parent.postMessage({glob:'height',id:ID,h:Math.ceil(Math.max(d.scrollHeight,b?b.scrollHeight:0))},'*')}
addEventListener('load',size);
try{new ResizeObserver(size).observe(document.documentElement)}catch(e){}
addEventListener('error',function(e){parent.postMessage({glob:'error',id:ID,message:String(e.message||e)},'*')});
})();`

const safeJson = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, (c) => (c === '\u2028' ? '\\u2028' : '\\u2029'))

/** The page that goes into the iframe: our shim first, then the person's code unchanged. */
function build(id: string, html: string, data: Record<string, string>, dark: boolean) {
  const head =
    `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<style>:root{color-scheme:${dark ? 'dark' : 'light'}}:where(html){font-family:system-ui,sans-serif;color:${dark ? '#f2f2f4' : '#0c0c0d'}}</style>` +
    `<script>${SHIM.replace('__ID__', safeJson(id)).replace('__DATA__', safeJson(data))}</script>`
  // go inside the person's <head> if they wrote a whole page, otherwise in front of their snippet
  const m = html.match(/<head[^>]*>/i) ?? html.match(/<html[^>]*>/i)
  return m ? html.slice(0, m.index! + m[0].length) + head + html.slice(m.index! + m[0].length) : head + html
}

type Status = 'idle' | 'saving' | 'saved' | 'failed'
const MIN_H = 120
const MAX_H = 900

/**
 * One pasted block. Its code runs in an iframe with no access to this app (no cookies, no account, no other blocks):
 * `sandbox` without `allow-same-origin` makes it a separate, powerless origin. What it keeps in localStorage is saved
 * to the server as JSON a moment after each change, and handed back the next time the block loads.
 */
export default function CodeBlock({ widget, onData }: { widget: Widget; onData?: (id: string, data: Record<string, string>) => void }) {
  const { theme } = useTheme()
  const frame = useRef<HTMLIFrameElement>(null)
  const dataRef = useRef<Record<string, string>>(widget.data ?? {})
  const dirty = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [height, setHeight] = useState(240)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')

  // rebuilt only when the code or theme changes, never when the block saves its own data (that would reload it mid-use)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const srcDoc = useMemo(() => build(widget.id, widget.html, dataRef.current, theme === 'dark'), [widget.id, widget.html, theme])

  const url = `${API_URL}/personal/widgets/${widget.id}/data`
  const save = () => {
    if (!dirty.current) return
    dirty.current = false
    setStatus('saving')
    api.put(`/personal/widgets/${widget.id}/data`, { data: dataRef.current })
      .then(() => setStatus('saved'))
      .catch(() => { dirty.current = true; setStatus('failed') })
  }
  // leaving the page: send what is left even though the page is closing
  const flush = () => {
    if (!dirty.current) return
    dirty.current = false
    fetch(url, { method: 'PUT', keepalive: true, headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ data: dataRef.current }) }).catch(() => {})
  }

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const m = e.data
      if (!m || m.glob === undefined || m.id !== widget.id || e.source !== frame.current?.contentWindow) return
      if (m.glob === 'storage' && m.data && typeof m.data === 'object') {
        dataRef.current = m.data
        dirty.current = true
        onData?.(widget.id, m.data)
        clearTimeout(timer.current)
        timer.current = setTimeout(save, 800)
      } else if (m.glob === 'height' && typeof m.h === 'number') setHeight(Math.min(MAX_H, Math.max(MIN_H, m.h)))
      else if (m.glob === 'error') setError(String(m.message).slice(0, 300))
    }
    window.addEventListener('message', onMessage)
    window.addEventListener('pagehide', flush)
    return () => { window.removeEventListener('message', onMessage); window.removeEventListener('pagehide', flush); clearTimeout(timer.current); flush() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widget.id])

  useEffect(() => { setError('') }, [widget.html])

  return (
    <div className="cb">
      <iframe ref={frame} title={widget.title} srcDoc={srcDoc} style={{ height }} referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-forms allow-modals allow-popups allow-downloads" />
      <div className="cb-foot">
        {error ? <span className="cb-err" title={error}>Error in your code: {error}</span> : <span />}
        <small className="muted">{status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : status === 'failed' ? 'Could not save — will retry' : ''}</small>
      </div>
    </div>
  )
}
