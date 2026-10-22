document.addEventListener('DOMContentLoaded', () => {
  const counters = document.querySelectorAll('[data-target]');
  const revealItems = document.querySelectorAll('.reveal');

  const animateCounter = (counter) => {
    const target = Number(counter.dataset.target || 0);
    const duration = 1500;
    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(target * eased);
      counter.textContent = value + (counter.dataset.suffix || '');

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  };

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  revealItems.forEach((item) => observer.observe(item));

  const slider = document.querySelector('.slider-class');
  if (slider) {
    const slides = Array.from(slider.querySelectorAll('.slider-slide'));
    const dots = Array.from(slider.querySelectorAll('.slider-dot'));
    const previousButton = slider.querySelector('.slider-previous');
    const nextButton = slider.querySelector('.slider-next');
    let activeIndex = 0;
    let autoAdvance;

    const showSlide = (index) => {
      slides.forEach((slide, slideIndex) => {
        const isActive = slideIndex === index;
        slide.classList.toggle('is-active', isActive);
        slide.setAttribute('aria-hidden', String(!isActive));
        dots[slideIndex].classList.toggle('is-active', isActive);
        dots[slideIndex].setAttribute('aria-pressed', String(isActive));
      });
      activeIndex = index;
    };

    const startAutoAdvance = () => {
      window.clearInterval(autoAdvance);
      if (slides.length > 1) {
        autoAdvance = window.setInterval(() => {
          showSlide((activeIndex + 1) % slides.length);
        }, 5000);
      }
    };

    dots.forEach((dot, index) => {
      dot.addEventListener('click', () => {
        showSlide(index);
        startAutoAdvance();
      });
    });

    previousButton.addEventListener('click', () => {
      showSlide((activeIndex - 1 + slides.length) % slides.length);
      startAutoAdvance();
    });
    nextButton.addEventListener('click', () => {
      showSlide((activeIndex + 1) % slides.length);
      startAutoAdvance();
    });
    startAutoAdvance();
  }

  const counterObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach((counter) => counterObserver.observe(counter));

  const yearNode = document.querySelector('[data-current-year]');
  if (yearNode) {
    yearNode.textContent = new Date().getFullYear();
  }
});
