# Copyright (c) 2025, AIM Hi Technologies and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class AIMatchingConfiguration(Document):
	def before_save(self):
		"""Set created timestamp and user"""
		if not self.created_on:
			self.created_on = frappe.utils.now()
		if not self.created_by:
			self.created_by = frappe.session.user

	def validate(self):
		"""Validate configuration weights"""
		# Check that weights sum to 100%
		total_weight = (
			(self.skills_weight or 0) +
			(self.keywords_weight or 0) +
			(self.domain_experience_weight or 0) +
			(self.experience_level_weight or 0) +
			(self.professional_depth_weight or 0)
		)
		
		if abs(total_weight - 100) > 0.01:  # Allow small floating point differences
			frappe.throw(f"Total weights must equal 100%. Current total: {total_weight}%")

		# Ensure only one active configuration
		if self.is_active:
			existing_active = frappe.db.exists("AI Matching Configuration", {
				"is_active": 1,
				"name": ["!=", self.name]
			})
			if existing_active:
				frappe.throw("Only one configuration can be active at a time. Please deactivate the existing active configuration first.")

	@staticmethod
	def get_active_config():
		"""Get the currently active AI matching configuration"""
		active_config = frappe.get_all("AI Matching Configuration", 
			filters={"is_active": 1}, 
			fields="*",
			limit=1
		)
		
		if active_config:
			return active_config[0]
		else:
			# Return default configuration
			return {
				"skills_weight": 25,
				"keywords_weight": 25,
				"domain_experience_weight": 20,
				"experience_level_weight": 15,
				"professional_depth_weight": 15,
				"minimum_match_threshold": 40,
				"openai_model": "gpt-4o-mini"
			}