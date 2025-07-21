# Copyright (c) 2025, AIM Hi Technologies and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class AIMatchResult(Document):
	def before_save(self):
		"""Set processed timestamp and user"""
		if not self.processed_on:
			self.processed_on = frappe.utils.now()
		if not self.processed_by:
			self.processed_by = frappe.session.user

	def validate(self):
		"""Validate AI match result data"""
		# Ensure scores are within valid range (0-100)
		score_fields = [
			'match_percentage', 'skills_score', 'experience_score',
			'keywords_score', 'professional_depth_score', 'domain_experience_score'
		]
		
		for field in score_fields:
			score = self.get(field)
			if score and (score < 0 or score > 100):
				frappe.throw(f"{field.replace('_', ' ').title()} must be between 0 and 100")

		# Set match grade based on percentage
		if self.match_percentage:
			if self.match_percentage >= 80:
				self.match_grade = "Excellent"
			elif self.match_percentage >= 60:
				self.match_grade = "Good"
			elif self.match_percentage >= 40:
				self.match_grade = "Fair"
			else:
				self.match_grade = "Poor"