import {documentSignature} from './document-signature.mjs';

// Reuse the verified private director image only after the matching recorded action.
export async function advanceSignatures(env,request){
 const events=request.events||[],latest=action=>events.filter(e=>e.action===action).at(-1);
 const valid=e=>e&&e.actor_email?.toLowerCase()==='mulyadi@yayasangambut.org'&&
 !['draft','returned','cancelled'].includes(request.status)&&
 !events.some(x=>x.action==='return'&&x.version>e.version);
 async function image(e){return valid(e)?documentSignature(env,{status:'approved',reviewed_at:e.created_at,reviewer_email:e.actor_email.toLowerCase()}):null;}
 const submitted=latest('submit'),approved=latest('approve');
 return {applicant:request.creator_email?.toLowerCase()==='mulyadi@yayasangambut.org'?await image(submitted):null,approver:await image(approved)};
}
