// Stand-in photographs from Wikimedia Commons, shown until companies add their own.
// Each is credited where it appears.
const thumb = (path, name, w = 1280) => `https://upload.wikimedia.org/wikipedia/commons/thumb/${path}/${name}/${w}px-${name}`;
const photo = (path, name, o) => ({
  src: thumb(path, name),
  srcSet: [960, 1280, 1920].map((w) => `${thumb(path, name, w)} ${w}w`).join(', '),
  ...o,
});

export const HERO = photo('d/d0', 'Drying_the_cotton_silk_fabric.jpg', {
  alt: 'A woman in a straw hat hanging rows of dyed yarn to dry, seen from above',
  caption: 'Dyed cotton and silk yarn drying in the sun.',
  credit: 'Sopyaylynn', license: 'CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:Drying_the_cotton_silk_fabric.jpg',
  w: 3600, h: 2400, position: '70% 50%',
});

const MATERIAL = [
  [/denim|jeans/i, photo('4/41', 'Jeansfabric.jpg', { alt: 'Blue denim twill weave, close up', subject: 'denim', credit: 'Thegreenj', license: 'CC BY-SA 3.0', page: 'https://commons.wikimedia.org/wiki/File:Jeansfabric.jpg', position: '50% 50%' })],
  [/silk/i, photo('6/61', 'Indian-dupioni-silk-fabrics.JPG', { alt: 'Stacked bolts of raw silk in violet, red, orange, blue and green', subject: 'silk', credit: 'Smriti tripathi', license: 'CC BY 3.0', page: 'https://commons.wikimedia.org/wiki/File:Indian-dupioni-silk-fabrics.JPG', position: '50% 50%' })],
  [/handwoven|handloom|weav|batik|block|scarves|sarong/i, photo('4/4b', 'Hands_and_threads.jpg', { alt: 'Hands drawing red threads across the fingers at a loom', subject: 'hand weaving', credit: 'Alberto Buscató Vázquez', license: 'CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:Hands_and_threads.jpg', position: '60% 50%' })],
  [/yarn|recycled|waste|polyester|knit|jersey|t-shirt|tee|sweatshirt|loungewear|babywear|activewear|leggings/i, photo('c/c6', 'Worsted_rug_yarn_on_cones.jpg', { alt: 'Cones of yarn in soft pinks, blues, ochre and black', subject: 'yarn', credit: 'Emilymaayy', license: 'CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:Worsted_rug_yarn_on_cones.jpg', position: '50% 50%' })],
  [/shirt|dress|outerwear|jacket|tailor|garment|apparel/i, photo('d/d5', 'Bhura_Singh%2C_Tailor_from_Rampura_Jawaharwala%2C_Punjab%2C_India_01.jpg', { alt: 'A tailor at a treadle sewing machine in front of yellow and orange curtains', subject: 'tailoring', credit: 'Gurdeepdali', license: 'CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:Bhura_Singh,_Tailor_from_Rampura_Jawaharwala,_Punjab,_India_01.jpg', position: '50% 45%' })],
];
const CLOTH = photo('6/62', 'Cloth-roll.jpg', { alt: 'Rolls of handwoven striped and checked cotton stacked side by side', subject: 'woven cotton', credit: 'Samanthafara', license: 'CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:Cloth-roll.jpg', position: '45% 55%' });

// The picture for a company: chosen by what it makes or asks for, never presented as its own.
export function materialPhoto(text) {
  return (MATERIAL.find(([re]) => re.test(text)) || [null, CLOTH])[1];
}
