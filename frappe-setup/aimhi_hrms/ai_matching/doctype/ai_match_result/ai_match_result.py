"""
AI Match Result DocType Controller
"""

import frappe
from frappe.model.document import Document

class AIMatchResult(Document):
    def validate(self):
        # Validate match percentage is between 0 and 100
        if self.match_percentage < 0 or self.match_percentage > 100:
            frappe.throw("Match percentage must be between 0 and 100")
    
    def after_insert(self):
        # Update candidate's best match if this is better
        self.update_candidate_best_match()
    
    def update_candidate_best_match(self):
        """Update Job Applicant with best match information"""
        try:
            applicant = frappe.get_doc("Job Applicant", self.job_applicant)
            
            if not applicant.best_match_percentage or self.match_percentage > applicant.best_match_percentage:
                applicant.best_match_percentage = self.match_percentage
                applicant.best_match_job = self.job_opening
                applicant.save()
                
        except Exception as e:
            frappe.log_error(f"Error updating candidate best match: {str(e)}")
