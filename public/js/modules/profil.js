if (window.location.pathname === "/profil") {
    document.getElementById('photoInput').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toastr.error('Pilih foto');
            return;
        }

        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            toastr.error('Ukuran foto maksimal 5MB');
            return;
        }

        const formData = new FormData();
        formData.append('photo', file);

        try {
            const response = await fetch('/profil/update-photo', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                toastr.success('Foto berhasil diubah');
                const newImageUrl = `profil/photo/${result.adminId}?t=${new Date().getTime()}`;
                document.querySelector('.img-profile').src = newImageUrl;
                document.querySelector('.rounded-circle.mb-3.mt-4').src = newImageUrl;
            } else {
                toastr.error(result.message || 'Failed to update photo');
            }
        } catch (error) {
            console.error('Error:', error);
        }
    });

    document.getElementById('profileForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username');
        const email = document.getElementById('email');
        const currentPassword = document.getElementById('currentPassword');
        const newPassword = document.getElementById('newPassword');

        if (username.value.trim().length < 3) {
            toastr.error('Username must be at least 3 characters long');
            return;
        }

        if (!email.value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            toastr.error('Please enter a valid email address');
            return;
        }

        if (newPassword.value && !currentPassword.value) {
            toastr.error('Current password is required to change password');
            return;
        }

        const formData = {
            username: username.value.trim(),
            email: email.value.trim(),
            currentPassword: currentPassword.value,
            newPassword: newPassword.value
        };

        try {
            const response = await fetch('/profil/update-profil', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok) {
                toastr.success(result.message);
                
                const usernameElement = document.querySelector('.d-none.d-lg-inline.text-gray-600.small');
                if (usernameElement) {
                    usernameElement.textContent = username.value;
                }

                currentPassword.value = '';
                newPassword.value = '';
                
                if (email.value !== result.previousEmail) {
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                }
            } else {
                toastr.error(result.message || 'Failed to update profile');
            }
        } catch (error) {
            console.error('Error:', error);
        }
    });
}
