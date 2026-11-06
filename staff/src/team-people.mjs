// KUPS-only identities remain ineligible unless a Director has explicitly
// connected their organizational employee identity to a timesheet. Login
// restrictions, application roles and access to unrelated records are unchanged.
export async function teamPeople(env){
 const exists=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='team_timesheet_files'").first();
 const linked=exists?" OR EXISTS(SELECT 1 FROM team_timesheet_files t WHERE t.user_id=users.id)":'';
 return (await env.DB.prepare("SELECT id,name,email FROM users WHERE disabled=0 AND email LIKE ? AND (NOT EXISTS(SELECT 1 FROM webgis_access a WHERE a.email=users.email AND a.scope='kups-finance')"+linked+") ORDER BY name").bind('%@'+env.GOOGLE_WORKSPACE_DOMAIN).all()).results;
}
