from setuptools import setup, find_packages

with open("requirements.txt") as f:
	install_requires = f.read().strip().split("\n")

# get version from __version__ variable in aimhi_hrms/__init__.py
from aimhi_hrms import __version__ as version

setup(
	name="aimhi_hrms",
	version=version,
	description="AI-Enhanced HRMS with Advanced Candidate Matching",
	author="AIM Hi Technologies",
	author_email="support@aimhi.app",
	packages=find_packages(),
	zip_safe=False,
	include_package_data=True,
	install_requires=install_requires
)