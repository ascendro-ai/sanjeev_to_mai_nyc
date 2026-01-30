/*
 * Global Teardown for E2E Tests
 * Uncomment when tests are enabled
 */

// import { FullConfig } from '@playwright/test'
// import { createClient } from '@supabase/supabase-js'

// async function globalTeardown(config: FullConfig) {
//   console.log('Running global teardown...')

//   // Only cleanup in CI or when explicitly requested
//   if (process.env.CLEANUP_AFTER_TESTS !== 'true' && !process.env.CI) {
//     console.log('Skipping cleanup (set CLEANUP_AFTER_TESTS=true to enable)')
//     return
//   }

//   // Initialize Supabase client
//   const supabase = createClient(
//     process.env.SUPABASE_URL!,
//     process.env.SUPABASE_SERVICE_ROLE_KEY!
//   )

//   try {
//     console.log('Cleaning up test data...')

//     // Delete test data in correct order due to foreign keys
//     await supabase.from('review_requests').delete().eq('execution_id', 'default-exec')
//     await supabase.from('execution_steps').delete().neq('id', '')
//     await supabase.from('executions').delete().neq('id', '')
//     await supabase.from('activity_logs').delete().eq('metadata->test', 'true')
//     await supabase.from('workflow_steps').delete().neq('id', '')
//     await supabase.from('workflows').delete().eq('organization_id', 'default-org')
//     await supabase.from('digital_workers').delete().eq('organization_id', 'default-org')

//     // Optionally delete test user's organization
//     // Be careful not to delete production data
//     const { data: testOrg } = await supabase
//       .from('organizations')
//       .select('id')
//       .eq('slug', 'test-org')
//       .single()

//     if (testOrg) {
//       await supabase.from('organization_members').delete().eq('organization_id', testOrg.id)
//       await supabase.from('organizations').delete().eq('id', testOrg.id)
//     }

//     console.log('Cleanup complete')
//   } catch (error) {
//     console.error('Cleanup failed:', error)
//   }

//   console.log('Global teardown complete')
// }

// export default globalTeardown

export {}
