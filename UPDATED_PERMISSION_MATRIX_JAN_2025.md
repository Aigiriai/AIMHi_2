# Updated Detailed Permission Matrix (January 2025)

## Overview
This document reflects the current implementation of role-based permissions after the January 2025 updates that simplified candidate upload workflows and implemented proper visibility restrictions.

## Job Management Permissions

| Role | Create Jobs | View Jobs | Edit Jobs | Delete Jobs | Assign Jobs | View Assignments |
|------|-------------|-----------|-----------|-------------|-------------|------------------|
| **Super Admin** | ✅ All orgs | ✅ All orgs | ✅ All orgs | ✅ All orgs | ✅ All orgs | ✅ All orgs |
| **Org Admin** | ✅ Own org | ✅ All in org | ✅ All in org | ✅ All in org | ✅ All in org | ✅ All in org |
| **Manager** | ✅ Own org | ✅ Created + Assigned | ✅ Created + Assigned | ✅ Created only | ✅ All in org | ✅ Created + Assigned |
| **Team Lead** | ❌ No | ✅ Assigned only | ❌ No | ❌ No | ❌ No | ✅ Assigned only |
| **Recruiter** | ❌ No | ✅ Assigned only | ❌ No | ❌ No | ❌ No | ✅ Assigned only |

## Candidate Management Permissions (UPDATED)

| Role | Upload Candidates | View Candidates | Edit Candidates | Delete Candidates | Assign Candidates | Schedule Interviews |
|------|-------------------|-----------------|-----------------|-------------------|-------------------|-------------------|
| **Super Admin** | ✅ All orgs | ✅ All orgs | ✅ All orgs | ✅ All orgs | ✅ All orgs | ✅ All orgs |
| **Org Admin** | ✅ Own org | ✅ All in org | ✅ All in org | ✅ All in org | ✅ All in org | ✅ All in org |
| **Manager** | ✅ Own org | ✅ Created + Assigned | ✅ Created + Assigned | ✅ Created only | ✅ All in org | ✅ Created + Assigned |
| **Team Lead** | ✅ Own org¹ | ✅ Assigned only² | ✅ Assigned only | ❌ No | ❌ No | ✅ Assigned only |
| **Recruiter** | ✅ Own org¹ | ✅ Assigned only² | ✅ Assigned only | ❌ No | ❌ No | ✅ Assigned only |

## Key Implementation Details

### ¹ Upload Process for Team Lead/Recruiter:
- **Single Workflow**: Same "Upload Resume" button for all roles (no separate submission workflows)
- **Special Messaging**: Success message includes: "Your submissions will be reviewed by managers for assignment to jobs. Please follow up with your HR manager for status updates."
- **Database Storage**: Candidates uploaded successfully to main candidates table immediately
- **No Dual Tables**: No separate submission tables - all candidates go to same database table

### ² Visibility Restrictions (Critical Change):
- **Team Lead/Recruiter**: Can ONLY see candidates assigned to them by managers (NOT their own uploads)
- **Manager**: Can see candidates they uploaded + candidates assigned to them
- **Org Admin**: Can see all candidates in organization regardless of who uploaded them
- **Assignment Control**: Only Managers and above can assign candidate visibility to Team Lead/Recruiter

## Upload Workflow Hierarchy:

```
Team Lead/Recruiter uploads → Visible to Org Admin only → Manager assigns → Visible to Team Lead/Recruiter
Manager uploads → Visible to Manager + Org Admin immediately
Org Admin uploads → Visible to Org Admin immediately
```

## Implementation Status (January 2025)

### ✅ Completed Features:
1. **Unified Upload Interface**: Removed single upload, only bulk upload interface remains
2. **Role-based Messaging**: Different success messages based on user role
3. **Visibility Restrictions**: Team Lead/Recruiter cannot see their own uploads until assigned
4. **Assignment System**: Managers can assign candidate visibility through existing assignment interface
5. **Hierarchical Access**: Org Admin can see all candidates, Managers see created+assigned, Team Lead/Recruiter see assigned only

### 🔄 Current Behavior Verified:
- **Recruiter uploads** → Visible to Org Admin → Not visible to Manager until assigned → Not visible to Recruiter until assigned
- **Manager uploads** → Visible to Manager + Org Admin immediately
- **Assignment system** → Works correctly for granting Team Lead/Recruiter access to specific candidates

### 📋 Technical Implementation:
- **Backend**: Role-based visibility filtering in `/api/candidates` endpoint
- **Frontend**: Simplified upload modal with only bulk upload interface
- **Database**: Single candidates table, no submission tables
- **Messaging**: Custom backend messages displayed in frontend toast notifications
- **Permissions**: Assignment-based access control working correctly

## Benefits of Current Implementation:

1. **Simplified Workflow**: Single upload process for all roles eliminates confusion
2. **Proper Hierarchy**: Org Admin oversight of all uploads, Manager control of visibility
3. **Assignment-based Access**: Flexible system where managers control Team Lead/Recruiter access
4. **Clear Messaging**: Users understand their upload will be reviewed
5. **Database Efficiency**: Single table structure, no complex dual workflows
6. **Audit Trail**: All uploads tracked with proper created_by attribution

## Future Considerations:

1. **Notification System**: Could add notifications when candidates are assigned to Team Lead/Recruiter
2. **Bulk Assignment**: Could add bulk assignment interface for managers
3. **Upload Analytics**: Could track upload volumes by role for organizational insights
4. **Assignment History**: Could add audit trail for candidate assignments

---

*Last Updated: January 26, 2025*
*Status: Implemented and Verified*