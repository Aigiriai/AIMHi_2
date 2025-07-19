frappe.ui.form.on('Job Opening', {
    refresh: function(frm) {
        if (frm.doc.enable_ai_matching) {
            // Add AI Matching button
            frm.add_custom_button(__('Run AI Matching'), function() {
                frappe.call({
                    method: "aimhi_hrms.ai_core.matching_engine.run_ai_matching_batch",
                    args: {
                        job_opening: frm.doc.name
                    },
                    callback: function(r) {
                        if (r.message) {
                            frappe.show_alert({
                                message: `AI matching started for ${r.message.total_candidates} candidates`,
                                indicator: 'green'
                            });
                        }
                    }
                });
            }, __('AI Actions'));
            
            // Add View Results button
            frm.add_custom_button(__('View AI Results'), function() {
                frappe.set_route("List", "AI Match Result", {
                    "job_opening": frm.doc.name
                });
            }, __('AI Actions'));
        }
    }
});