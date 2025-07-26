# Detailed Permission Matrix

| Action | Super Admin | Org Admin | Hiring Manager | Recruiter |
|--------|-------------|-----------|----------------|-----------|
| **Job Management** | | | | |
| Create Jobs | 🟢 All Orgs | 🟢 Own Org | 🟢 Own Jobs | ❌ |
| Edit Job Details | 🟢 All | 🟢 Own Org | 🟢 Own Jobs | ❌ |
| Change Job Status | 🟢 All | 🟢 Own Org | 🟢 Own Jobs | ❌ |
| Delete Jobs | 🟢 All | 🟢 Own Org | 🟢 Own Jobs | ❌ |
| **Candidate Management** | | | | |
| Add Candidates | 🟢 All | 🟢 Own Org | 🟢 Assigned Jobs | 🟢 Assigned Jobs |
| Move to Screening | 🟢 All | 🟢 Own Org | 🟢 Assigned Jobs | 🟢 Assigned Jobs |
| Move to Interview | 🟢 All | 🟢 Own Org | 🟢 Assigned Jobs | 🔵 Requires Approval |
| Final Hiring Decision | 🟢 All | 🟢 Own Org | 🟢 Assigned Jobs | ❌ |
| **Pipeline Visibility** | | | | |
| View All Jobs | 🟢 System | 🟢 Own Org | ❌ Assigned Only | ❌ Assigned Only |
| Cross-Job Analytics | 🟢 System | 🟢 Own Org | ❌ Own Jobs Only | ❌ Assigned Only |
| **Configuration** | | | | |
| Pipeline Stages | 🟢 System | 🔵 Org-specific | ❌ | ❌ |
| Automation Rules | 🟢 System | 🔵 Org-specific | ❌ | ❌ |

## Legend
- 🟢 **Full Access** - Complete permissions for specified scope
- 🔵 **Limited Access** - Restricted permissions or requires approval
- ❌ **No Access** - Action not permitted for this role

## Key Implementation Details

### Upload Process for Team Lead/Recruiter:
- **Single Workflow**: Same "Upload Resume" button for all roles (no separate submission workflows)
- **Special Messaging**: Success message includes: "Your submissions will be reviewed by managers for assignment to jobs. Please follow up with your HR manager for status updates."
- **Database Storage**: Candidates uploaded successfully to main candidates table immediately
- **No Dual Tables**: No separate submission tables - all candidates go to same database table

### Visibility Restrictions (Critical Change):
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