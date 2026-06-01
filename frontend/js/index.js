document.querySelectorAll('.portal-option').forEach((button) => {
    button.addEventListener('click', () => {
        const target = button.dataset.target;

        if (target) {
            window.location.href = target;
        }
    });
});
