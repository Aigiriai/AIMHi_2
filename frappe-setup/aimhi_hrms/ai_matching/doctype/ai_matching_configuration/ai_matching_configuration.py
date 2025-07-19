"""
AI Matching Configuration DocType Controller
"""

import frappe
from frappe.model.document import Document

class AIMatchingConfiguration(Document):
    def validate(self):
        # Validate weights sum to 100
        total_weight = (self.skills_weight + self.experience_weight + 
                       self.keywords_weight + self.professional_depth_weight + 
                       self.domain_experience_weight)
        
        if total_weight != 100:
            frappe.throw(f"Total weights must equal 100%. Current total: {total_weight}%")
