let flowerRenderer;

function setupFlowerRenderer() {
  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = 200;
  offscreenCanvas.height = 200;

  flowerRenderer = new p5(p => {
    p.setup = () => {
      p.createCanvas(200, 200, p.WEBGL, offscreenCanvas);
      p.angleMode(p.DEGREES);
      p.noLoop();
      p.canvas.style.display = 'none';
    };

    p.drawFlower = (f) => {
      p.stroke('#7053ad');
      p.strokeWeight(0.5);
      p.noFill();
      for (let theta = 0; theta < 60; theta += 2) {
        p.beginShape(p.POINTS);
        for (let phi = 0; phi < 360; phi += 8) {
          let r = (f.petalScale * Math.pow(Math.abs(Math.sin(phi * (f.numPetals / 2))), 1) + 50) * (theta / 60);
          let x = r * Math.cos(phi);
          let y = r * Math.sin(phi);
          let z = f.stemLen * Math.pow(Math.E, -0.15 * Math.pow(Math.abs(r / 100), 1.5)) * Math.pow(Math.abs(r / 100), 0.8);
          p.vertex(x, y, z);
        }
        p.endShape();
      }
    };

    p.generateFlowerImage = (name, index) => {
      // Seeded from name so the icon is stable across reloads
      let rng = seededRng(hashStr(name + index));
      const f = {
        numPetals: Math.floor(rng() * 6 + 4),
        stemLen:   rng() * 80 + 40,
        petalScale: rng() * 20 + 10,
        heightOffset: rng() * 20 - 10,
        rotOffset: rng() * 360,
      };
      p.clear();
      p.push();
      p.rotateX(f.rotOffset);
      p.rotateY(f.rotOffset * 1.3);
      p.drawFlower(f);
      p.pop();
      return p.canvas.toDataURL('image/png');
    };
  });
}

// Wait for main p5 sketch to load first (so seededRng/hashStr are available)
window.addEventListener('load', () => {
  setupFlowerRenderer();

  fetch('data.json')
    .then(res => res.json())
    .then(jsonData => {
      const list = document.getElementById('name-list');
      const allNames = jsonData.flatMap(d => d.names || []);

      allNames.forEach((name, i) => {
        const li = document.createElement('li');

        const imgSrc = flowerRenderer.generateFlowerImage(name, i);
        const img = document.createElement('img');
        img.src = imgSrc;
        img.alt = 'Flower symbol';
        img.classList.add('flower-icon');

        const span = document.createElement('span');
        span.textContent = name;

        li.appendChild(img);
        li.appendChild(span);
        list.appendChild(li);
      });

      // Scroll fade-in — items fully inside viewport appear instantly,
      // items near the bottom edge animate in with a row-based stagger.
      const observer = new IntersectionObserver(entries => {
        const vh = window.innerHeight;

        entries.forEach(e => {
          if (!e.isIntersecting) {
            e.target.style.transitionDelay = '0ms';
            e.target.classList.remove('visible');
            return;
          }

          // If item top is well inside viewport, show instantly (no animation)
          if (e.boundingClientRect.top < vh * 0.75) {
            e.target.style.transition = 'none';
            e.target.classList.add('visible');
            // Re-enable transition after paint
            requestAnimationFrame(() => {
              e.target.style.transition = '';
            });
          } else {
            e.target.style.transitionDelay = '0ms';
            e.target.classList.add('visible');
          }
        });
      }, { threshold: 0.1 });

      document.querySelectorAll('#name-list li').forEach(li => observer.observe(li));
    });
});
