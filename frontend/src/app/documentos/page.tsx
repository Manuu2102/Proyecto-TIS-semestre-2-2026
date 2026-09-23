"use client";
import { useMemo, useState } from "react";
import { DashboardLayout } from "../../../components/DashboardLayout";
import { Modal } from "../../../components/Modal";
import { FileIcon, SearchIcon, PlusIcon, TrashIcon, EyeIcon } from "../../../components/Icons";

type Doc={id:number;nombre:string;categoria:string;fecha:string;tamano:string;restringido:boolean};
const cats=["Actas","Reglamentos","Contratos","Facturas","Fotografías","Cotizaciones"];
const initial:Doc[]=[
{id:1,nombre:"Acta de Asamblea General 2026.pdf",categoria:"Actas",fecha:"02/09/2026",tamano:"2.4 MB",restringido:false},
{id:2,nombre:"Reglamento de Copropiedad.pdf",categoria:"Reglamentos",fecha:"15/08/2026",tamano:"1.1 MB",restringido:false},
{id:3,nombre:"Contrato mantenimiento ascensores.pdf",categoria:"Contratos",fecha:"28/07/2026",tamano:"3.8 MB",restringido:true},
{id:4,nombre:"Factura servicios comunes.pdf",categoria:"Facturas",fecha:"01/09/2026",tamano:"680 KB",restringido:false}];
export default function DocumentosPage(){
 const [items,setItems]=useState(initial),[q,setQ]=useState(""),[cat,setCat]=useState("Todas"),[open,setOpen]=useState(false);
 const filtered=useMemo(()=>items.filter(x=>(cat==="Todas"||x.categoria===cat)&&(`${x.nombre} ${x.categoria}`.toLowerCase().includes(q.toLowerCase()))),[items,q,cat]);
 function upload(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget),file=String(f.get("file")||"");if(!file)return;const extension=file.toLowerCase().split(".").pop();if(!["pdf","jpg","jpeg","png","docx"].includes(extension||""))return;setItems([{id:Date.now(),nombre:file,categoria:String(f.get("categoria")),fecha:"06/09/2026",tamano:"1.2 MB",restringido:f.get("restringido")==="on"},...items]);setOpen(false);}
 return <DashboardLayout active="documentos"><div className="page-header"><div><p className="eyebrow">EP-08 · REPOSITORIO</p><h1>Gestión documental</h1><p>Centraliza, clasifica, consulta y controla el acceso a los documentos del edificio.</p></div><button className="btn btn-primary" onClick={()=>setOpen(true)}><PlusIcon size={17}/> Subir documento</button></div>
 <div className="metric-row"><Metric t="Documentos" n={items.length}/><Metric t="Categorías" n={cats.length}/><Metric t="Restringidos" n={items.filter(x=>x.restringido).length}/></div>
 <section className="panel"><div className="panel-toolbar"><div><h3>Repositorio del edificio</h3><p>Formatos permitidos: PDF, DOCX, JPG y PNG · máximo 10 MB</p></div><div className="search-box"><SearchIcon size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar documento..."/></div></div>
 <div className="doc-filters"><button className={cat==="Todas"?"filter-chip active":"filter-chip"} onClick={()=>setCat("Todas")}>Todos</button>{cats.map(c=><button key={c} className={cat===c?"filter-chip active":"filter-chip"} onClick={()=>setCat(c)}>{c}</button>)}</div>
 <div className="document-grid">{filtered.map(x=><article className="document-card" key={x.id}><div className="doc-icon"><FileIcon size={24}/></div><div className="doc-body"><div className="doc-top"><span className="tag">{x.categoria}</span>{x.restringido&&<span className="status status-attention"><span/>Restringido</span>}</div><h4>{x.nombre}</h4><p>{x.fecha} · {x.tamano}</p></div><div className="doc-actions"><button className="icon-action" title="Consultar"><EyeIcon size={16}/></button><button className="icon-action danger" title="Eliminar" onClick={()=>{if(confirm("¿Confirmas eliminar este documento?"))setItems(items.filter(i=>i.id!==x.id))}}><TrashIcon size={16}/></button></div></article>)}</div>
 {filtered.length===0&&<div className="empty-state">No existen documentos que coincidan con la búsqueda.</div>}</section>
 <Modal open={open} title="Subir documento" onClose={()=>setOpen(false)}><form className="modal-form" onSubmit={upload}><div className="form-grid"><Field label="Archivo" name="file" type="file" accept=".pdf,.docx,.jpg,.jpeg,.png"/><Select label="Categoría" name="categoria"/><label className="check-label"><input name="restringido" type="checkbox"/> Documento restringido</label></div><div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={()=>setOpen(false)}>Cancelar</button><button className="btn btn-primary">Guardar documento</button></div></form></Modal>
 </DashboardLayout>}
function Metric({t,n}:{t:string;n:number}){return <div className="metric-card"><div className="metric-icon"><FileIcon size={20}/></div><div><span>{t}</span><strong>{n}</strong></div></div>}
function Field(p:any){return <label className="field"><span>{p.label}</span><input {...p}/></label>}
function Select({label,name}:{label:string;name:string}){return <label className="field"><span>{label}</span><select name={name}>{cats.map(c=><option key={c}>{c}</option>)}</select></label>}