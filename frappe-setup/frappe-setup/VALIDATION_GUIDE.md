# AIM Hi HRMS Integration Validation Guide

## Quick Validation Checklist

### ✅ Infrastructure Validation
- [ ] Docker services running: `docker-compose ps`
- [ ] Database accessible: `docker-compose exec db mysql -u frappe -pfrappe_pass frappe_hrms`
- [ ] Frappe responding: `curl http://localhost:8001`
- [ ] Redis operational: `docker-compose exec redis redis-cli ping`

### ✅ Application Validation  
- [ ] Login successful: Administrator / admin123
- [ ] HRMS module visible in desk
- [ ] Job Opening form accessible
- [ ] Job Applicant form accessible
- [ ] AI Matching Configuration accessible

### ✅ Integration Validation
- [ ] Custom DocTypes exist: AI Match Result, AI Matching Configuration
- [ ] Job Opening has AI Matching section with custom fields
- [ ] Job Opening has "Run AI Matching" button
- [ ] OpenAI API key configured in AI Matching Configuration
- [ ] Matching weights sum to 100%

### ✅ Functional Validation
- [ ] Create Job Opening with detailed description
- [ ] Create Job Applicant with resume attachment
- [ ] Click "Run AI Matching" button
- [ ] Check AI Match Result creation
- [ ] Verify match percentage and reasoning
- [ ] Validate criteria scores (skills, experience, keywords, depth, domain)

## Troubleshooting Guide

### Issue: Services Won't Start
```bash
# Check logs
docker-compose logs

# Restart services
docker-compose down
docker-compose up -d

# Rebuild if needed  
docker-compose down --volumes
docker-compose up --build -d
```

### Issue: Database Connection Failed
```bash
# Check database logs
docker-compose logs db

# Reset database
docker-compose down
docker volume rm frappe-setup_mariadb_data
docker-compose up -d db
```

### Issue: Custom App Not Installed
```bash
# Reinstall custom app
docker-compose exec frappe bash -c "
  cd /home/frappe/frappe-bench &&
  bench --site aimhi-hrms.local uninstall-app aimhi_hrms --yes &&
  bench --site aimhi-hrms.local install-app aimhi_hrms
"
```

### Issue: AI Matching Not Working
1. Check OpenAI API key in AI Matching Configuration
2. Verify Python dependencies: `docker-compose exec frappe pip list | grep openai`
3. Check background jobs: Frappe > Background Jobs
4. Review error logs in Frappe > Error Log

### Issue: DocTypes Missing
```bash
# Migrate DocTypes
docker-compose exec frappe bash -c "
  cd /home/frappe/frappe-bench &&
  bench --site aimhi-hrms.local migrate
"
```

## Performance Monitoring

### Monitor Resource Usage
```bash
# Container resources
docker stats

# Database performance
docker-compose exec db mysql -u frappe -pfrappe_pass -e "SHOW PROCESSLIST;" frappe_hrms
```

### Monitor AI Processing
- Check AI Processing Queue DocType for batch job status
- Monitor API calls and costs in processing records
- Review background job queue for failures

## Success Criteria

The integration is successfully deployed when:

1. **Infrastructure**: All Docker services healthy and accessible
2. **Authentication**: Login works with provided credentials  
3. **Navigation**: HRMS modules accessible, custom DocTypes visible
4. **Configuration**: AI settings configured with valid API key
5. **Functionality**: AI matching produces results with proper scoring
6. **Performance**: Response times acceptable, no memory/CPU issues
7. **Data Integrity**: Match results stored correctly, candidate updates work

## Next Steps After Validation

1. **Production Configuration**: Update passwords, API keys, resource limits
2. **User Training**: Create user guides for HR team
3. **Data Migration**: Import existing job openings and candidates
4. **Monitoring Setup**: Configure alerts and performance monitoring
5. **Backup Strategy**: Set up regular database and file backups
