from setuptools import setup, find_packages

setup(
    name='newrev',
    version='0.1.0', 
    packages=find_packages(), 
    include_package_data=True,
    install_requires=[
        'flask==2.3.3',
        'flask-cors==4.0.0',
        'flask-socketio==5.3.6',
        'eventlet==0.33.3',
        'python-socketio==5.10.0',
        'python-engineio==4.8.2'
    ],
    entry_points={
        'console_scripts': [
            'newrev-api=api.app:main', 
        ],
    },
    author='Gerardo Suarez', 
    author_email='andresuarezz2693@gmail.com', 
    description='A browser-based UI for terminal AI coding agents.',
    long_description=open('README.md').read(),
    long_description_content_type='text/markdown',
    url='https://github.com/andresuarezz26/newrev.io',  
    classifiers=[
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.12', 
        'License :: OSI Approved :: MIT License',
        'Operating System :: OS Independent',
    ],
    python_requires='>=3.10', 
)