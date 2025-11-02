import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

const loader = new GLTFLoader()

// Render a glTF model to an offscreen canvas and return it
export async function renderModelThumbnail(url, options = {}) {
  const width = options.width || 256
  const height = options.height || 256

  return new Promise((resolve, reject) => {
    loader.load(url, (gltf) => {
      try {
        const scene = new THREE.Scene()
        scene.add(gltf.scene)

        // simple lighting
        const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2)
        scene.add(light)
        const dir = new THREE.DirectionalLight(0xffffff, 0.8)
        dir.position.set(0, 10, 10)
        scene.add(dir)

        // compute model bounding box
        const box = new THREE.Box3().setFromObject(gltf.scene)
        const size = new THREE.Vector3()
        box.getSize(size)
        const center = new THREE.Vector3()
        box.getCenter(center)

        // position camera to fit model
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
        const maxDim = Math.max(size.x, size.y, size.z)
        const fov = camera.fov * (Math.PI / 180)
        let cameraZ = Math.abs(maxDim / Math.sin(fov / 2))
        cameraZ *= 1.2
        camera.position.set(center.x, center.y + maxDim * 0.2, center.z + cameraZ)
        camera.lookAt(center)

        // center model
        gltf.scene.position.x -= center.x
        gltf.scene.position.y -= center.y
        gltf.scene.position.z -= center.z

        const renderer = new THREE.WebGLRenderer({ alpha: true, preserveDrawingBuffer: true })
        renderer.setSize(width, height)
        renderer.setClearColor(0x000000, 0)

        renderer.render(scene, camera)

        const canvas = renderer.domElement
        // create image
        const img = new Image()
        img.onload = () => {
          // dispose resources
          renderer.dispose()
          resolve(img)
        }
        img.onerror = (e) => { renderer.dispose(); reject(e) }
        img.src = canvas.toDataURL('image/png')
      } catch (e) {
        reject(e)
      }
    }, undefined, (err) => {
      reject(err)
    })
  })
}
