set -o errexit

pip install -r req.txt

python manage.py collectstatic --no-input

python manage.py migrate

