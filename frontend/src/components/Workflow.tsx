import type {Run} from '../types';

type Props={busy:string;stale:boolean;runs:Run[];available:boolean;canStatic:boolean;canResilient:boolean;canSimulate:boolean;execute:(kind:Run['kind']|'simulation')=>void};
export function Workflow({busy,stale,runs,available,canStatic,canResilient,canSimulate,execute}:Props){
 const next=stale||!runs.length?'Load baseline':!canResilient?'Static optimize':!canSimulate?'Resilience optimize':'Simulate & compare';
 const steps=[
  {kind:'baseline',title:'Load baseline',enabled:!busy&&available,reason:'Wait for the study area to load.'},
  {kind:'static',title:'Static optimize',enabled:canStatic,reason:'Load a baseline with the current assumptions first.'},
  {kind:'resilient',title:'Resilience optimize',enabled:canResilient,reason:'Calculate a feasible static placement first.'},
  {kind:'simulation',title:'Simulate & compare',enabled:canSimulate,reason:'Calculate a feasible resilient placement first.'},
 ] as const;
 return <section className="workflow" aria-label="Planning workflow">
  <div className="workflow-intro"><strong>Build your comparison</strong><span>{busy?`${busy}…`:`Next: ${next}`}</span></div>
  <div className="actions">{steps.map((step,i)=><button key={step.kind} className={next===step.title?'primary':''} disabled={!step.enabled} title={step.enabled?step.title:busy?'A calculation is in progress.':step.reason} onClick={()=>execute(step.kind)}><b className="step-number">{i+1}</b><span>{step.title}</span><b aria-hidden="true">→</b></button>)}</div>
 </section>;
}
