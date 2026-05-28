'use client'

import { supabase } from '@/lib/supabase'

export default function Home() {

  async function testBackend() {
    const { data, error } = await supabase
      .from('Alokeshfitness')
      .insert([
        {
          name: 'Alokesh'
        }
      ])

    console.log(data)
    console.log(error)

    if(error){
      alert(error.message)
    } else {
      alert('Backend connected')
    }
  }

  return (
    <button onClick={testBackend}>
      Test Backend
    </button>
  )
}
